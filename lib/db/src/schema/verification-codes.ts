import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const VERIFICATION_TYPES = ["email_verify", "password_reset"] as const;
export type VerificationType = typeof VERIFICATION_TYPES[number];

export const verificationCodesTable = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  type: text("type").notNull().$type<VerificationType>(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VerificationCode = typeof verificationCodesTable.$inferSelect;
