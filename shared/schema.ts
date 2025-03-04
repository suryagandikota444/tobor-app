import { pgTable, text, serial, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const robots = pgTable("robots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("idle"),
  position: jsonb("position").notNull().default({ x: 0, y: 0, z: 0 }),
  batteryLevel: integer("battery_level").notNull().default(100),
  isConnected: boolean("is_connected").notNull().default(false),
  motor1Angle: integer("motor1_angle").notNull().default(0), // 0-360 degrees
  motor2Angle: integer("motor2_angle").notNull().default(0)  // 0-180 degrees
});

export const robotCommands = pgTable("robot_commands", {
  id: serial("id").primaryKey(),
  robotId: integer("robot_id").notNull(),
  command: text("command").notNull(),
  params: jsonb("params"),
  status: text("status").notNull().default("pending")
});

export const insertRobotSchema = createInsertSchema(robots).omit({ 
  id: true 
});

export const insertCommandSchema = createInsertSchema(robotCommands).omit({
  id: true,
  status: true
});

export type Robot = typeof robots.$inferSelect;
export type InsertRobot = z.infer<typeof insertRobotSchema>;
export type RobotCommand = typeof robotCommands.$inferSelect;
export type InsertCommand = z.infer<typeof insertCommandSchema>;