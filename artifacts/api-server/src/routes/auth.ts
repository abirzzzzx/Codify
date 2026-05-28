import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, verificationCodesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { signToken } from "../lib/jwt";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
import { requireAuth } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rate-limit";
import { randomBytes } from "crypto";

const router = Router();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function codeExpiry(minutes = 15): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body as Record<string, string>;
    if (!email || !username || !password) {
      res.status(400).json({ error: "email, username and password are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      res.status(400).json({ error: "Username must be 3-30 alphanumeric characters or underscores." });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));
    if (existing) {
      res.status(409).json({ error: "Email already registered." });
      return;
    }

    const [existingUsername] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existingUsername) {
      res.status(409).json({ error: "Username already taken." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), username, passwordHash })
      .returning({ id: usersTable.id, email: usersTable.email, username: usersTable.username });

    const code = generateCode();
    await db.insert(verificationCodesTable).values({
      userId: user.id,
      code,
      type: "email_verify",
      expiresAt: codeExpiry(15),
    });

    await sendVerificationEmail(user.email, user.username, code);

    res.status(201).json({
      message: "Account created. Check your email for a verification code.",
      userId: user.id,
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed.", detail: String(err) });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as Record<string, string>;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required." });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ error: "Your account has been suspended." });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed.", detail: String(err) });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization!.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    res.json({ message: "Logged out successfully." });
  } catch (err) {
    res.status(500).json({ error: "Logout failed.", detail: String(err) });
  }
});

router.post("/verify-email", authLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body as Record<string, string>;
    if (!userId || !code) {
      res.status(400).json({ error: "userId and code are required." });
      return;
    }

    const [vc] = await db
      .select()
      .from(verificationCodesTable)
      .where(
        and(
          eq(verificationCodesTable.userId, userId),
          eq(verificationCodesTable.code, code),
          eq(verificationCodesTable.type, "email_verify"),
          gt(verificationCodesTable.expiresAt, new Date())
        )
      );

    if (!vc) {
      res.status(400).json({ error: "Invalid or expired verification code." });
      return;
    }

    if (vc.usedAt) {
      res.status(400).json({ error: "Code already used." });
      return;
    }

    await db.update(usersTable).set({ isVerified: true }).where(eq(usersTable.id, userId));
    await db
      .update(verificationCodesTable)
      .set({ usedAt: new Date() })
      .where(eq(verificationCodesTable.id, vc.id));

    res.json({ message: "Email verified successfully." });
  } catch (err) {
    res.status(500).json({ error: "Verification failed.", detail: String(err) });
  }
});

router.post("/resend-verification", authLimiter, async (req, res) => {
  try {
    const { email } = req.body as Record<string, string>;
    if (!email) {
      res.status(400).json({ error: "email is required." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      res.json({ message: "If that email exists, a code has been sent." });
      return;
    }
    if (user.isVerified) {
      res.status(400).json({ error: "Email is already verified." });
      return;
    }

    const code = generateCode();
    await db.insert(verificationCodesTable).values({
      userId: user.id,
      code,
      type: "email_verify",
      expiresAt: codeExpiry(15),
    });

    await sendVerificationEmail(user.email, user.username, code);
    res.json({ message: "Verification code sent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to resend verification.", detail: String(err) });
  }
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body as Record<string, string>;
    if (!email) {
      res.status(400).json({ error: "email is required." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      res.json({ message: "If that email exists, a reset code has been sent." });
      return;
    }

    const code = generateCode();
    await db.insert(verificationCodesTable).values({
      userId: user.id,
      code,
      type: "password_reset",
      expiresAt: codeExpiry(15),
    });

    await sendPasswordResetEmail(user.email, user.username, code);
    res.json({ message: "Password reset code sent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to send reset code.", detail: String(err) });
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { userId, code, newPassword } = req.body as Record<string, string>;
    if (!userId || !code || !newPassword) {
      res.status(400).json({ error: "userId, code, and newPassword are required." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const [vc] = await db
      .select()
      .from(verificationCodesTable)
      .where(
        and(
          eq(verificationCodesTable.userId, userId),
          eq(verificationCodesTable.code, code),
          eq(verificationCodesTable.type, "password_reset"),
          gt(verificationCodesTable.expiresAt, new Date())
        )
      );

    if (!vc || vc.usedAt) {
      res.status(400).json({ error: "Invalid or expired reset code." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
    await db
      .update(verificationCodesTable)
      .set({ usedAt: new Date() })
      .where(eq(verificationCodesTable.id, vc.id));

    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));

    res.json({ message: "Password reset successfully. Please log in again." });
  } catch (err) {
    res.status(500).json({ error: "Password reset failed.", detail: String(err) });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body as Record<string, string>;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.user!.id));
    res.json({ message: "Password changed successfully." });
  } catch (err) {
    res.status(500).json({ error: "Password change failed.", detail: String(err) });
  }
});

export default router;
