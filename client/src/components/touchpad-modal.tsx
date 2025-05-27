import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  robotId: number;
}

export default function TouchpadModal({ open, onOpenChange, robotId }: Props) {
  const touchpadRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [motor1Angle, setMotor1Angle] = useState(0);
  const [motor2Angle, setMotor2Angle] = useState(0);
  const [motor3Angle, setMotor3Angle] = useState(0);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const ROBOT_API_BASE_URL = "http://192.168.4.1/set_angle";

  // Helper function to send angle commands via HTTP GET
  const sendAngleCommand = (servo: number, angle: number) => {
    const roundedAngle = Math.round(angle);
    const url = `${ROBOT_API_BASE_URL}?servo=${servo}&angle=${roundedAngle}`;
    fetch(url)
      .then(response => {
        if (!response.ok) {
          console.error(`Error sending command for servo ${servo} to ${url}. Status: ${response.status}`);
        }
        else {
          console.log(`Command sent successfully for servo ${servo}: ${url}`);
        }
      })
      .catch(error => {
        console.error(`Network error or failed to send command for servo ${servo} to ${url}:`, error);
      });
  };

  // Reset Angles When Modal Closes
  useEffect(() => {
    if (!open) {
      setMotor1Angle(0);
      setMotor2Angle(0);
      setMotor3Angle(0);
    }
  }, [open]);

  // Handle Drag Start
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  // Handle Drag Movement with Real-Time WebSocket Sending
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !touchpadRef.current) return;

    const sensitivity = 0.5;
    const deltaX = (clientX - startPos.x) * sensitivity;
    const deltaY = (clientY - startPos.y) * sensitivity;

    // Calculate new angles based on current state
    const newAngle1 = Math.min(Math.max(motor1Angle + deltaX, 0), 360);
    const newAngle2 = Math.min(Math.max(motor2Angle + deltaY, 0), 180);
    const newAngle3 = Math.min(Math.max(motor3Angle + deltaY, 0), 180);

    // Send angles via HTTP GET requests
    sendAngleCommand(1, newAngle1);
    sendAngleCommand(2, newAngle2);
    sendAngleCommand(3, newAngle3); // Servo 3 uses newAngle2

    console.log(`Sent angles - M1: ${Math.round(newAngle1)}°, M2: ${Math.round(newAngle2)}°, M3: ${Math.round(newAngle3)}°`);

    // Update state for UI display
    setMotor1Angle(newAngle1);
    setMotor2Angle(newAngle2);
    setMotor3Angle(newAngle3); // Update motor3Angle state
    setStartPos({ x: clientX, y: clientY });
  };

  // Handle Drag End
  const handleEnd = () => {
    setIsDragging(false);
    // No API request needed since angles are sent in real-time
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motor Control</DialogTitle>
        </DialogHeader>
        <div
          ref={touchpadRef}
          className="w-full aspect-square bg-accent/10 rounded-lg touch-none cursor-grab relative"
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleEnd}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-sm text-muted-foreground text-center">
              <div>Motor 1: {Math.round(motor1Angle)}°</div>
              <div>Motor 2: {Math.round(motor2Angle)}°</div>
              <div>Motor 3: {Math.round(motor3Angle)}°</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}