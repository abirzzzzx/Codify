import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const PROJECT_STATUSES = ["running", "stopped", "error", "starting", "stopping"] as const;
export const PROJECT_TYPES = ["nodejs", "python", "discord", "api", "websocket"] as const;

export type ProjectStatus = typeof PROJECT_STATUSES[number];
export type ProjectType = typeof PROJECT_TYPES[number];

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().$type<ProjectType>(),
  status: text("status").notNull().default("stopped").$type<ProjectStatus>(),
  port: integer("port"),
  entrypoint: text("entrypoint").notNull().default("index.js"),
  pid: integer("pid"),
  isDisabled: boolean("is_disabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Project = typeof projectsTable.$inferSelect;
