import type { User } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "email" | "username" | "isAdmin" | "isSuspended" | "isVerified">;
    }
  }
}

export {};
