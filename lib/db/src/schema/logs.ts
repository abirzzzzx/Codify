import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const LOG_LEVELS = ["info", "error", "warn", "system"] as const;
export type LogLevel = typeof LOG_LEVELS[number];

export const logsTable = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("info").$type<LogLevel>(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Log = typeof logsTable.$inferSelect;
