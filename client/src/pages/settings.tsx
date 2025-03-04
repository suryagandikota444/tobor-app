import { useQuery } from "@tanstack/react-query";
import { Robot } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const { data: robot } = useQuery<Robot>({
    queryKey: ["/api/robots/1"],
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-notifications">Task Notifications</Label>
              <Switch id="task-notifications" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="battery-notifications">Battery Alerts</Label>
              <Switch id="battery-notifications" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="status-notifications">Status Updates</Label>
              <Switch id="status-notifications" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Robot Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div>
              <Label>Name</Label>
              <p className="text-muted-foreground">{robot?.name}</p>
            </div>
            <div>
              <Label>Status</Label>
              <p className="text-muted-foreground">{robot?.status}</p>
            </div>
            <div>
              <Label>Battery Level</Label>
              <p className="text-muted-foreground">{robot?.batteryLevel}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
