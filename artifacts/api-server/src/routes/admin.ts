import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, projectsTable, logsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { stopProject, getRunningProcesses } from "../lib/process-manager";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        isVerified: usersTable.isVerified,
        isSuspended: usersTable.isSuspended,
        isAdmin: usersTable.isAdmin,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable);
    res.json({ users, count: users.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users.", detail: String(err) });
  }
});

router.post("/users/:id/suspend", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (user.isAdmin) {
      res.status(400).json({ error: "Cannot suspend an admin." });
      return;
    }

    const projects = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.userId, user.id));
    for (const p of projects) {
      await stopProject(p.id);
    }

    await db.update(usersTable).set({ isSuspended: true }).where(eq(usersTable.id, user.id));
    res.json({ message: `User '${user.username}' suspended.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to suspend user.", detail: String(err) });
  }
});

router.post("/users/:id/unsuspend", async (req, res) => {
  try {
    const [user] = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.params.id));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    await db.update(usersTable).set({ isSuspended: false }).where(eq(usersTable.id, user.id));
    res.json({ message: `User '${user.username}' unsuspended.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to unsuspend user.", detail: String(err) });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (user.isAdmin) {
      res.status(400).json({ error: "Cannot delete an admin." });
      return;
    }

    const projects = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.userId, user.id));
    for (const p of projects) {
      await stopProject(p.id);
    }

    await db.delete(usersTable).where(eq(usersTable.id, user.id));
    res.json({ message: `User '${user.username}' deleted.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user.", detail: String(err) });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable);
    res.json({ projects, count: projects.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects.", detail: String(err) });
  }
});

router.post("/projects/:id/disable", async (req, res) => {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    await stopProject(project.id);
    await db.update(projectsTable).set({ isDisabled: true, status: "stopped" }).where(eq(projectsTable.id, project.id));

    await db.insert(logsTable).values({
      projectId: project.id,
      userId: project.userId,
      level: "system",
      message: `Project disabled by admin (${req.user!.username}).`,
    });

    res.json({ message: "Project disabled." });
  } catch (err) {
    res.status(500).json({ error: "Failed to disable project.", detail: String(err) });
  }
});

router.post("/projects/:id/enable", async (req, res) => {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    await db.update(projectsTable).set({ isDisabled: false }).where(eq(projectsTable.id, project.id));

    await db.insert(logsTable).values({
      projectId: project.id,
      userId: project.userId,
      level: "system",
      message: `Project enabled by admin (${req.user!.username}).`,
    });

    res.json({ message: "Project enabled." });
  } catch (err) {
    res.status(500).json({ error: "Failed to enable project.", detail: String(err) });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    await stopProject(project.id);
    await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
    res.json({ message: "Project deleted by admin." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project.", detail: String(err) });
  }
});

router.get("/processes", (_req, res) => {
  const procs = getRunningProcesses();
  res.json({ processes: procs, count: procs.length });
});

router.post("/projects/:id/stop", async (req, res) => {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id));
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const result = await stopProject(project.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    await db.insert(logsTable).values({
      projectId: project.id,
      userId: project.userId,
      level: "system",
      message: `Project stopped by admin (${req.user!.username}).`,
    });

    res.json({ message: "Project stopped by admin." });
  } catch (err) {
    res.status(500).json({ error: "Failed to stop project.", detail: String(err) });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    const projects = await db.select({ id: projectsTable.id, status: projectsTable.status }).from(projectsTable);
    const running = getRunningProcesses();

    res.json({
      stats: {
        totalUsers: users.length,
        totalProjects: projects.length,
        runningProjects: running.length,
        stoppedProjects: projects.filter((p) => p.status === "stopped").length,
        errorProjects: projects.filter((p) => p.status === "error").length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats.", detail: String(err) });
  }
});

export default router;
