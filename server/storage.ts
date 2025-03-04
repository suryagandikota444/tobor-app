import { Robot, InsertRobot, RobotCommand, InsertCommand } from "@shared/schema";

export interface IStorage {
  getRobot(id: number): Promise<Robot | undefined>;
  getRobots(): Promise<Robot[]>;
  updateRobotStatus(id: number, status: string): Promise<Robot>;
  updateMotorAngles(id: number, motor1: number, motor2: number): Promise<Robot>;
  sendCommand(command: InsertCommand): Promise<RobotCommand>;
  getCommands(robotId: number): Promise<RobotCommand[]>;
}

export class MemStorage implements IStorage {
  private robots: Map<number, Robot>;
  private commands: Map<number, RobotCommand>;
  private commandId: number = 1;

  constructor() {
    this.robots = new Map();
    this.commands = new Map();

    // Add demo robot
    this.robots.set(1, {
      id: 1,
      name: "Home Assistant Bot",
      status: "idle",
      position: { x: 0, y: 0, z: 0 },
      batteryLevel: 85,
      isConnected: true,
      motor1Angle: 0,
      motor2Angle: 0
    });
  }

  async getRobot(id: number): Promise<Robot | undefined> {
    return this.robots.get(id);
  }

  async getRobots(): Promise<Robot[]> {
    return Array.from(this.robots.values());
  }

  async updateRobotStatus(id: number, status: string): Promise<Robot> {
    const robot = this.robots.get(id);
    if (!robot) throw new Error("Robot not found");

    const updated = { ...robot, status };
    this.robots.set(id, updated);
    return updated;
  }

  async updateMotorAngles(id: number, motor1: number, motor2: number): Promise<Robot> {
    const robot = this.robots.get(id);
    if (!robot) throw new Error("Robot not found");

    const updated = { 
      ...robot, 
      motor1Angle: Math.min(Math.max(motor1, 0), 360),
      motor2Angle: Math.min(Math.max(motor2, 0), 180)
    };
    this.robots.set(id, updated);
    return updated;
  }

  async sendCommand(command: InsertCommand): Promise<RobotCommand> {
    const id = this.commandId++;
    const newCommand: RobotCommand = {
      id,
      robotId: command.robotId,
      command: command.command,
      params: command.params || null,
      status: "pending"
    };
    this.commands.set(id, newCommand);
    return newCommand;
  }

  async getCommands(robotId: number): Promise<RobotCommand[]> {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.robotId === robotId);
  }
}

export const storage = new MemStorage();