import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  robotId: number;
}

export default function TouchpadModal({ open, onOpenChange, robotId }: Props) {
  const touchpadRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [motor1Angle, setMotor1Angle] = useState(0);
  const [motor2Angle, setMotor2Angle] = useState(0);
  const [motor3Angle, setMotor3Angle] = useState(0);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // WebSocket Setup with useEffect
  useEffect(() => {
    console.log('Connecting to ESP32');
    if (open) {
      // Replace 'ESP32_IP_ADDRESS' with your ESP32's actual IP and port
      // ws.current = new WebSocket('ws://192.168.1.76:81');
      ws.current = new WebSocket('ws://192.168.1.76:81');
      ws.current.onopen = () => console.log('Connected to ESP32');
      ws.current.onclose = () => console.log('Disconnected from ESP32');
      ws.current.onerror = (error) => console.error('WebSocket error:', error);
    }

    // Cleanup: Close WebSocket when modal closes or component unmounts
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [open]);

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

    // Send angles over WebSocket if connection is open
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(`angle1:${newAngle1},angle2:${newAngle2},angle3:${newAngle2}`);
    }

    console.log(`Motor angles - 1: ${Math.round(newAngle1)}°, 2: ${Math.round(newAngle2)}°`);

    // Update state for UI display
    setMotor1Angle(newAngle1);
    setMotor2Angle(newAngle2);
    setMotor3Angle(newAngle2);
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
              <div>Motor 2: {Math.round(motor3Angle)}°</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}