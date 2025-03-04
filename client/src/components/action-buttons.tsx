import { Lock, Coffee, Blinds, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import TouchpadModal from "./touchpad-modal";

interface Props {
  robotId: number;
}

export default function ActionButtons({ robotId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [touchpadOpen, setTouchpadOpen] = useState(false);

  async function sendCommand(command: string) {
    try {
      await apiRequest("POST", `/api/robots/${robotId}/command`, { command });
      queryClient.invalidateQueries({ queryKey: [`/api/robots/${robotId}`] });
      toast({
        title: "Command sent",
        description: `Robot is executing: ${command}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send command to robot",
      });
    }
  }

  return (
    <>
      <div className="flex gap-4">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 backdrop-blur-sm"
          onClick={() => sendCommand("toggle_blinds")}
        >
          <Blinds className="h-6 w-6" />
        </Button>

        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 backdrop-blur-sm"
          onClick={() => sendCommand("make_drink")}
        >
          <Coffee className="h-6 w-6" />
        </Button>

        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 backdrop-blur-sm"
          onClick={() => sendCommand("toggle_locks")}
        >
          <Lock className="h-6 w-6" />
        </Button>

        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 backdrop-blur-sm"
          onClick={() => setTouchpadOpen(true)}
        >
          <Gamepad2 className="h-6 w-6" />
        </Button>
      </div>

      <TouchpadModal
        open={touchpadOpen}
        onOpenChange={setTouchpadOpen}
        robotId={robotId}
      />
    </>
  );
}