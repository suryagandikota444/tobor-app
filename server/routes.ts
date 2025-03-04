import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertCommandSchema } from "@shared/schema";

export async function registerRoutes(app: Express) {
  app.get("/api/robots", async (_req, res) => {
    const robots = await storage.getRobots();
    res.json(robots);
  });

  app.get("/api/robots/:id", async (req, res) => {
    const robot = await storage.getRobot(Number(req.params.id));
    if (!robot) return res.status(404).json({ message: "Robot not found" });
    res.json(robot);
  });

  app.post("/api/robots/:id/command", async (req, res) => {
    const robotId = Number(req.params.id);
    const robot = await storage.getRobot(robotId);
    if (!robot) return res.status(404).json({ message: "Robot not found" });

    const result = insertCommandSchema.safeParse({ ...req.body, robotId });
    if (!result.success) {
      return res.status(400).json({ errors: result.error.errors });
    }

    const command = await storage.sendCommand(result.data);

    if (result.data.command === "set_motors" && result.data.params) {
      const { motor1, motor2 } = result.data.params;
      await storage.updateMotorAngles(robotId, motor1, motor2);
    } else {
      // Simulate command execution for other commands
      setTimeout(async () => {
        await storage.updateRobotStatus(robotId, result.data.command);
      }, 1000);
    }

    res.json(command);
  });

  app.get("/api/robots/:id/commands", async (req, res) => {
    const commands = await storage.getCommands(Number(req.params.id));
    res.json(commands);
  });

  return createServer(app);
}