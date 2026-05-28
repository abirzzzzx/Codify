import { Router } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { projectsTable, envVarsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireVerified } from "../middlewares/auth";
import { getProjectDir } from "../lib/process-manager";

const router = Router({ mergeParams: true });

router.use(requireVerified);

function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

function writeEnvFile(envPath: string, vars: Record<string, string>): void {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
}

async function getProject(projectId: string, userId: string) {
  const [p] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return p ?? null;
}

router.get("/", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const metadata = await db
      .select()
      .from(envVarsTable)
      .where(eq(envVarsTable.projectId, project.id));

    const projectDir = getProjectDir(project.userId, project.name);
    const envPath = path.join(projectDir, ".env");
    const envValues = readEnvFile(envPath);

    const result = metadata.map((m) => ({
      id: m.id,
      key: m.key,
      description: m.description,
      hasValue: m.key in envValues,
      createdAt: m.createdAt,
    }));

    res.json({ envVars: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch env vars.", detail: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const { key, value, description } = req.body as Record<string, string>;
    if (!key || value === undefined) {
      res.status(400).json({ error: "key and value are required." });
      return;
    }

    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
      res.status(400).json({ error: "Invalid env var key format." });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    const envPath = path.join(projectDir, ".env");
    const envValues = readEnvFile(envPath);
    envValues[key] = value;
    writeEnvFile(envPath, envValues);

    const [existing] = await db
      .select()
      .from(envVarsTable)
      .where(and(eq(envVarsTable.projectId, project.id), eq(envVarsTable.key, key)));

    if (existing) {
      await db
        .update(envVarsTable)
        .set({ description: description ?? existing.description })
        .where(eq(envVarsTable.id, existing.id));
    } else {
      await db.insert(envVarsTable).values({
        projectId: project.id,
        key,
        description: description ?? null,
      });
    }

    res.json({ message: `Environment variable '${key}' saved.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to set env var.", detail: String(err) });
  }
});

router.delete("/:key", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const key = req.params.key;
    const projectDir = getProjectDir(project.userId, project.name);
    const envPath = path.join(projectDir, ".env");
    const envValues = readEnvFile(envPath);

    if (key in envValues) {
      delete envValues[key];
      writeEnvFile(envPath, envValues);
    }

    await db
      .delete(envVarsTable)
      .where(and(eq(envVarsTable.projectId, project.id), eq(envVarsTable.key, key)));

    res.json({ message: `Environment variable '${key}' deleted.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete env var.", detail: String(err) });
  }
});

router.get("/export", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    const envPath = path.join(projectDir, ".env");
    const envValues = readEnvFile(envPath);

    res.json({ envVars: envValues });
  } catch (err) {
    res.status(500).json({ error: "Failed to export env vars.", detail: String(err) });
  }
});

export default router;
