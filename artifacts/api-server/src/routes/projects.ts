import { Router } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { projectsTable, logsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireVerified } from "../middlewares/auth";
import {
  startProject,
  stopProject,
  restartProject,
  installPackages,
  ensureProjectDir,
  getProjectDir,
  isProjectRunning,
} from "../lib/process-manager";

const router = Router();

const PROJECTS_DIR = process.env.PROJECTS_DIR ?? path.join(process.cwd(), "projects");

router.use(requireVerified);

router.get("/", async (req, res) => {
  try {
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.userId, req.user!.id));

    const result = projects.map((p) => ({
      ...p,
      isRunning: isProjectRunning(p.id),
    }));

    res.json({ projects: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects.", detail: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, type, entrypoint, port } = req.body as Record<string, string>;
    if (!name || !type) {
      res.status(400).json({ error: "name and type are required." });
      return;
    }

    const validTypes = ["nodejs", "python", "discord", "api", "websocket"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
      return;
    }

    if (!/^[a-zA-Z0-9_\-]{1,50}$/.test(name)) {
      res.status(400).json({ error: "Project name must be 1-50 alphanumeric characters, dashes, or underscores." });
      return;
    }

    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.userId, req.user!.id), eq(projectsTable.name, name)));
    if (existing) {
      res.status(409).json({ error: "You already have a project with that name." });
      return;
    }

    const defaultEntry = type === "python" || (type === "discord" && entrypoint?.endsWith(".py"))
      ? "main.py"
      : "index.js";

    const [project] = await db
      .insert(projectsTable)
      .values({
        userId: req.user!.id,
        name,
        type,
        entrypoint: entrypoint ?? defaultEntry,
        port: port ? parseInt(port) : null,
      })
      .returning();

    ensureProjectDir(req.user!.id, name);

    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: "Failed to create project.", detail: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ project: { ...project, isRunning: isProjectRunning(project.id) } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch project.", detail: String(err) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const { entrypoint, port } = req.body as Record<string, string>;
    const updates: Partial<typeof project> = { updatedAt: new Date() };
    if (entrypoint) updates.entrypoint = entrypoint;
    if (port) updates.port = parseInt(port);

    const [updated] = await db
      .update(projectsTable)
      .set(updates)
      .where(eq(projectsTable.id, project.id))
      .returning();

    res.json({ project: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update project.", detail: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (isProjectRunning(project.id)) {
      await stopProject(project.id);
    }

    const projectDir = getProjectDir(project.userId, project.name);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }

    await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
    res.json({ message: "Project deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project.", detail: String(err) });
  }
});

router.post("/:id/start", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const result = await startProject(project.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ message: "Project starting." });
  } catch (err) {
    res.status(500).json({ error: "Failed to start project.", detail: String(err) });
  }
});

router.post("/:id/stop", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const result = await stopProject(project.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ message: "Project stopped." });
  } catch (err) {
    res.status(500).json({ error: "Failed to stop project.", detail: String(err) });
  }
});

router.post("/:id/restart", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const result = await restartProject(project.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ message: "Project restarted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to restart project.", detail: String(err) });
  }
});

router.post("/:id/install", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const { packageManager, packages } = req.body as { packageManager: "npm" | "pip"; packages: string[] };
    if (!packageManager || !packages || !Array.isArray(packages) || packages.length === 0) {
      res.status(400).json({ error: "packageManager (npm|pip) and packages array are required." });
      return;
    }

    if (!["npm", "pip"].includes(packageManager)) {
      res.status(400).json({ error: "packageManager must be npm or pip." });
      return;
    }

    const result = await installPackages(project.id, packageManager, packages);
    if (!result.success) {
      res.status(400).json({ error: result.error, output: result.output });
      return;
    }

    res.json({ message: "Packages installed.", output: result.output });
  } catch (err) {
    res.status(500).json({ error: "Failed to install packages.", detail: String(err) });
  }
});

export default router;
