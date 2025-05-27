import { useQuery } from "@tanstack/react-query";
import { Robot } from "@shared/schema";
import RobotViewer from "@/components/robot-viewer";
import ActionButtons from "@/components/action-buttons";
import DotBackground from "@/components/dot-background";
import { Battery, Wifi, WifiOff } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const { data: robot, isLoading } = useQuery<Robot>({
    queryKey: ["/api/robots/1"],
  });

  if (isLoading || !robot) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <DotBackground />
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center">
        <div className="absolute top-4 right-4 flex items-center gap-4 z-10 bg-background/20 backdrop-blur-sm px-4 py-2 rounded-full">
          <div className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            <Progress value={robot.batteryLevel} className="w-24" />
            <span className="text-sm text-foreground/80">
              {robot.batteryLevel}%
            </span>
          </div>
          {robot.isConnected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
          <ActionButtons robotId={robot.id} />
        </div>
      </div>
    </>
  );
}