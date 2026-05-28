import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header." });
    return;
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      isAdmin: usersTable.isAdmin,
      isSuspended: usersTable.isSuspended,
      isVerified: usersTable.isVerified,
    })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));

  if (!user) {
    res.status(401).json({ error: "User not found." });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "Your account has been suspended." });
    return;
  }

  req.user = user;
  next();
}

export async function requireVerified(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!req.user?.isVerified) {
      res.status(403).json({ error: "Email verification required." });
      return;
    }
    next();
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}
