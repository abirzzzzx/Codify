import nodemailer from "nodemailer";
import { logger } from "./logger";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const APP_NAME = process.env.APP_NAME ?? "TermuxHost";
const APP_URL = process.env.APP_URL ?? "http://localhost";

function createTransport() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    logger.warn("EMAIL_USER or EMAIL_PASS not set — email sending is disabled.");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to, subject }, "Email not sent — transport unavailable.");
    return false;
  }
  try {
    await transport.sendMail({
      from: `"${APP_NAME}" <${EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info({ to, subject }, "Email sent successfully.");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email.");
    return false;
  }
}

export async function sendVerificationEmail(to: string, username: string, code: string): Promise<boolean> {
  const subject = `${APP_NAME} — Verify Your Email`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#2563eb;">Welcome to ${APP_NAME}, ${username}!</h2>
      <p>Your email verification code is:</p>
      <div style="font-size:2rem;font-weight:bold;letter-spacing:0.25em;color:#1e293b;background:#f1f5f9;padding:16px 24px;border-radius:8px;display:inline-block;">${code}</div>
      <p>This code expires in <strong>15 minutes</strong>.</p>
      <p style="color:#64748b;font-size:0.875rem;">If you did not create an account, ignore this email.</p>
    </div>
  `;
  return sendMail(to, subject, html);
}

export async function sendPasswordResetEmail(to: string, username: string, code: string): Promise<boolean> {
  const subject = `${APP_NAME} — Reset Your Password`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#dc2626;">Password Reset — ${APP_NAME}</h2>
      <p>Hi ${username}, here is your password reset code:</p>
      <div style="font-size:2rem;font-weight:bold;letter-spacing:0.25em;color:#1e293b;background:#fef2f2;padding:16px 24px;border-radius:8px;display:inline-block;">${code}</div>
      <p>This code expires in <strong>15 minutes</strong>.</p>
      <p style="color:#64748b;font-size:0.875rem;">If you did not request a password reset, ignore this email.</p>
    </div>
  `;
  return sendMail(to, subject, html);
}
