import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { projectsTable, logsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const PROJECTS_DIR = process.env.PROJECTS_DIR ?? path.join(process.cwd(), "projects");

interface RunningProcess {
  process: ChildProcess;
  projectId: string;
  userId: string;
  startedAt: Date;
}

const processes = new Map<string, RunningProcess>();

export function getProjectDir(userId: string, projectName: string): string {
  return path.join(PROJECTS_DIR, userId, projectName);
}

export function ensureProjectDir(userId: string, projectName: string): string {
  const dir = getProjectDir(userId, projectName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function writeLog(projectId: string, userId: string, level: "info" | "error" | "warn" | "system", message: string) {
  try {
    await db.insert(logsTable).values({ projectId, userId, level, message });
  } catch (err) {
    logger.error({ err }, "Failed to write project log to DB");
  }
}

function resolveCommand(type: string, entrypoint: string): { cmd: string; args: string[] } {
  const isPython = type === "python" || (type === "discord" && entrypoint.endsWith(".py"));
  if (isPython) {
    return { cmd: "python", args: [entrypoint] };
  }
  return { cmd: "node", args: [entrypoint] };
}

export async function startProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  if (processes.has(projectId)) {
    return { success: false, error: "Project is already running." };
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) {
    return { success: false, error: "Project not found." };
  }
  if (project.isDisabled) {
    return { success: false, error: "Project is disabled by an admin." };
  }

  const projectDir = getProjectDir(project.userId, project.name);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const envFilePath = path.join(projectDir, ".env");
  const envVars: Record<string, string> = { ...process.env as Record<string, string> };

  if (fs.existsSync(envFilePath)) {
    const envContent = fs.readFileSync(envFilePath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      envVars[key] = value;
    }
  }

  await db.update(projectsTable).set({ status: "starting" }).where(eq(projectsTable.id, projectId));

  const { cmd, args } = resolveCommand(project.type, project.entrypoint);

  let proc: ChildProcess;
  try {
    proc = spawn(cmd, args, {
      cwd: projectDir,
      env: envVars,
      detached: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(projectsTable).set({ status: "error" }).where(eq(projectsTable.id, projectId));
    await writeLog(projectId, project.userId, "error", `Failed to start: ${msg}`);
    return { success: false, error: msg };
  }

  processes.set(projectId, {
    process: proc,
    projectId,
    userId: project.userId,
    startedAt: new Date(),
  });

  await db.update(projectsTable).set({ status: "running", pid: proc.pid ?? null }).where(eq(projectsTable.id, projectId));
  await writeLog(projectId, project.userId, "system", `Project started (PID: ${proc.pid})`);

  proc.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) writeLog(projectId, project.userId, "info", msg);
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) writeLog(projectId, project.userId, "error", msg);
  });

  proc.on("exit", async (code, signal) => {
    processes.delete(projectId);
    const status = code === 0 ? "stopped" : "error";
    await db.update(projectsTable).set({ status, pid: null }).where(eq(projectsTable.id, projectId));
    await writeLog(projectId, project.userId, "system", `Process exited (code=${code}, signal=${signal})`);
  });

  proc.on("error", async (err) => {
    processes.delete(projectId);
    await db.update(projectsTable).set({ status: "error", pid: null }).where(eq(projectsTable.id, projectId));
    await writeLog(projectId, project.userId, "error", `Process error: ${err.message}`);
  });

  return { success: true };
}

export async function stopProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  const entry = processes.get(projectId);
  if (!entry) {
    await db.update(projectsTable).set({ status: "stopped", pid: null }).where(eq(projectsTable.id, projectId));
    return { success: true };
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  await db.update(projectsTable).set({ status: "stopping" }).where(eq(projectsTable.id, projectId));

  return new Promise((resolve) => {
    const proc = entry.process;
    const timeout = setTimeout(async () => {
      try { proc.kill("SIGKILL"); } catch {}
      processes.delete(projectId);
      await db.update(projectsTable).set({ status: "stopped", pid: null }).where(eq(projectsTable.id, projectId));
      if (project) await writeLog(projectId, project.userId, "system", "Process killed (SIGKILL after timeout)");
      resolve({ success: true });
    }, 5000);

    proc.once("exit", async () => {
      clearTimeout(timeout);
      processes.delete(projectId);
      await db.update(projectsTable).set({ status: "stopped", pid: null }).where(eq(projectsTable.id, projectId));
      if (project) await writeLog(projectId, project.userId, "system", "Project stopped.");
      resolve({ success: true });
    });

    try {
      proc.kill("SIGTERM");
    } catch (err) {
      clearTimeout(timeout);
      processes.delete(projectId);
      resolve({ success: false, error: String(err) });
    }
  });
}

export async function restartProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  await stopProject(projectId);
  await new Promise<void>((r) => setTimeout(r, 500));
  return startProject(projectId);
}

export async function installPackages(
  projectId: string,
  packageManager: "npm" | "pip",
  packages: string[]
): Promise<{ success: boolean; output: string; error?: string }> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return { success: false, output: "", error: "Project not found." };

  const projectDir = getProjectDir(project.userId, project.name);

  const sanitized = packages.map((p) => p.replace(/[^a-zA-Z0-9@._\-~=<>^*/[\]{}()!?+]/g, "")).filter(Boolean);
  if (sanitized.length === 0) return { success: false, output: "", error: "No valid packages specified." };

  let cmd: string;
  let args: string[];
  if (packageManager === "npm") {
    cmd = "npm";
    args = ["install", "--no-audit", "--no-fund", ...sanitized];
  } else {
    cmd = "pip";
    args = ["install", ...sanitized];
  }

  return new Promise((resolve) => {
    let output = "";
    const proc = spawn(cmd, args, { cwd: projectDir, shell: false });
    proc.stdout?.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { output += d.toString(); });
    proc.on("exit", async (code) => {
      const level = code === 0 ? "system" : "error";
      await writeLog(projectId, project.userId, level, `Package install (${packageManager}): exit ${code}\n${output}`);
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output, error: `Process exited with code ${code}` });
      }
    });
    proc.on("error", (err) => {
      resolve({ success: false, output, error: err.message });
    });
  });
}

export function getRunningProcesses(): Array<{ projectId: string; userId: string; pid: number | undefined; startedAt: Date }> {
  return Array.from(processes.values()).map((p) => ({
    projectId: p.projectId,
    userId: p.userId,
    pid: p.process.pid,
    startedAt: p.startedAt,
  }));
}

export function isProjectRunning(projectId: string): boolean {
  return processes.has(projectId);
}
