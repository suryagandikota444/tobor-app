#include <WiFi.h>
#include <WebSocketsServer.h>
#include <AccelStepper.h>
#include <ESP32Servo.h>

// -------------------- WiFi credentials --------------------
const char* ssid     = "ATT_Guest";
const char* password = "Attguest17!";

// WebSocket server
WebSocketsServer webSocket(81);

// -------------------- Pins --------------------
#define stepPinBase    26
#define dirPinBase     27
#define enablePinBase  25

#define servoPin1 19
#define servoPin2 18

// -------------------- Stepper + Servos --------------------
#define STEPS_PER_REVOLUTION (200 * 9)  // e.g. 200 steps/rev * 9 if you have a gearbox

AccelStepper stepperBase(AccelStepper::DRIVER, stepPinBase, dirPinBase);

// Servos
Servo servoArm1;
Servo servoArm2;

// Convert base rotation angle (°) to step count
int baseAngleToSteps(float angleDegrees) {
  float stepsPerDegree = (float)STEPS_PER_REVOLUTION / 360.0;
  return (int)(angleDegrees * stepsPerDegree);
}

// -------------------- Dance Keyframes --------------------
// Each entry is { baseAngle, servo1Angle, servo2Angle, holdTime (ms) }
struct Keyframe {
  int baseAngle;
  int servo1Angle;
  int servo2Angle;
  unsigned long holdTime;
};

Keyframe danceMoves[] = {
  {  0,   0,   0,   1000 },
  { 90,  90,  90,   1000 },
  {  0,  45,  45,   1000 },
  { 90,  90,  90,   1000 },
  {  0,  45,  45,   1000 },
  { 90,  90,  90,   1000 }
};

const int NUM_KEYFRAMES = sizeof(danceMoves)/sizeof(danceMoves[0]);

// -------------------- Non-Blocking State Machine --------------------
enum MotionState {
  STATE_IDLE,       // No motion (initial)
  STATE_MOVING,     // Stepper + servos are moving to the new position
  STATE_HOLDING     // Both are at target; waiting holdTime
};

// Track current keyframe and overall state
int currentKeyframe = 0;
MotionState motionState = STATE_IDLE;

// -------------------- Time/Interpolation for Servos --------------------

// We'll interpolate servo angles over this duration (milliseconds).
// Increase it for slower servo movement, decrease for faster.
unsigned long servoMoveDuration = 700;

// We’ll track the start and target angles for both servos, and when we started moving.
int servoStartAngle1, servoStartAngle2;
int servoTargetAngle1, servoTargetAngle2;
unsigned long servoMoveStartTime = 0; 

// For each servo, store "last known" commanded angle so we can re-use it as a start next time.
int lastServoAngle1 = 0;
int lastServoAngle2 = 0;

// We'll also track the hold start time.
unsigned long holdStartTime = 0;

// -------------------- Setup --------------------
void setup() {
  Serial.begin(115200);

  // Initialize Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");

  // Initialize WebSocket
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // Stepper setup
  pinMode(enablePinBase, OUTPUT);
  digitalWrite(enablePinBase, LOW);  // Enable driver
  stepperBase.setMaxSpeed(2000.0);   // steps/sec
  stepperBase.setAcceleration(1000.0);

  // Attach servos
  servoArm1.attach(servoPin1);
  servoArm2.attach(servoPin2);

  // Initialize both servos at 0
  lastServoAngle1 = 0;
  lastServoAngle2 = 0;
  servoArm1.write(lastServoAngle1);
  servoArm2.write(lastServoAngle2);

  // Set stepper current position as 0
  stepperBase.setCurrentPosition(0);

  // Start first keyframe
  startKeyframeMove(currentKeyframe);
}

// -------------------- Main Loop --------------------
void loop() {
  webSocket.loop();

  // Update stepper (non-blocking)
  stepperBase.run();

  // Update keyframe motion logic (non-blocking)
  updateKeyframeMotion();
}

// -------------------- Start Keyframe Move --------------------
// This function sets up the stepper and servos to begin moving toward the
// next keyframe, then transitions the state to STATE_MOVING.
void startKeyframeMove(int kfIndex) {
  // 1) Stepper: compute target steps
  int targetSteps = baseAngleToSteps(danceMoves[kfIndex].baseAngle);
  stepperBase.moveTo(targetSteps);

  // 2) Setup servo interpolation
  // The start angle is the last angle we commanded. 
  // The target angle is from the new keyframe. 
  servoStartAngle1 = lastServoAngle1;
  servoStartAngle2 = lastServoAngle2;
  servoTargetAngle1 = danceMoves[kfIndex].servo1Angle;
  servoTargetAngle2 = danceMoves[kfIndex].servo2Angle;

  // Clamp servo angles to [0..180]
  if (servoTargetAngle1 < 0)   servoTargetAngle1 = 0;
  if (servoTargetAngle1 > 180) servoTargetAngle1 = 180;
  if (servoTargetAngle2 < 0)   servoTargetAngle2 = 0;
  if (servoTargetAngle2 > 180) servoTargetAngle2 = 180;

  // Record when we started moving
  servoMoveStartTime = millis();

  // Switch to MOVING state
  motionState = STATE_MOVING;
}

// -------------------- Update Keyframe Motion (Called in loop()) --------------------
void updateKeyframeMotion() {
  switch(motionState) {

    case STATE_MOVING:
    {
      // 1) Update servo angles by time interpolation
      unsigned long elapsed = millis() - servoMoveStartTime;
      float fraction = (float)elapsed / (float)servoMoveDuration;
      if (fraction > 1.0) fraction = 1.0; // Cap at 100%

      // Compute intermediate angles
      int currentAngle1 = servoStartAngle1 + (int)((servoTargetAngle1 - servoStartAngle1) * fraction);
      int currentAngle2 = servoStartAngle2 + (int)((servoTargetAngle2 - servoStartAngle2) * fraction);

      // Command servos
      servoArm1.write(currentAngle1);
      servoArm2.write(currentAngle2);

      // 2) Check if both stepper and servo motion are done
      bool stepperDone = (stepperBase.distanceToGo() == 0);
      bool servoDone = (fraction >= 1.0); // fraction=1 => servo has reached final angle

      // If both done, switch to HOLDING
      if (stepperDone && servoDone) {
        // Update "lastServoAngle" to reflect final angle
        lastServoAngle1 = servoTargetAngle1;
        lastServoAngle2 = servoTargetAngle2;

        // Record when hold started
        holdStartTime = millis();
        motionState = STATE_HOLDING;
      }
    }
    break;

    case STATE_HOLDING:
    {
      // Check if hold time has passed
      unsigned long holdTime = danceMoves[currentKeyframe].holdTime;
      if (millis() - holdStartTime >= holdTime) {
        // Move on to next keyframe
        currentKeyframe++;
        if (currentKeyframe >= NUM_KEYFRAMES) {
          currentKeyframe = 0; // loop back to start
        }
        startKeyframeMove(currentKeyframe);
      }
    }
    break;

    case STATE_IDLE:
    default:
      // Shouldn’t normally happen in this example, but
      // you could do something else or call startKeyframeMove(...) here.
      break;
  }
}

// -------------------- WebSocket Event Handler --------------------
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connection from %d.%d.%d.%d\n", 
                      num, ip[0], ip[1], ip[2], ip[3]);
      }
      break;
    case WStype_TEXT:
      {
        String text = String((char*)payload);
        Serial.printf("[%u] get Text: %s\n", num, text.c_str());
        // (Handle incoming messages if needed)
      }
      break;
    default:
      break;
  }
}