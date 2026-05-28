import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, logsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireVerified } from "../middlewares/auth";

const router = Router({ mergeParams: true });

router.use(requireVerified);

router.get("/", async (req, res) => {
  try {
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.projectId), eq(projectsTable.userId, req.user!.id)));

    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const limit = Math.min(parseInt((req.query.limit as string) ?? "100"), 500);
    const offset = parseInt((req.query.offset as string) ?? "0");
    const level = req.query.level as string | undefined;

    const query = db
      .select()
      .from(logsTable)
      .where(
        level
          ? and(eq(logsTable.projectId, project.id), eq(logsTable.level, level))
          : eq(logsTable.projectId, project.id)
      )
      .orderBy(desc(logsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = await query;

    res.json({ logs: logs.reverse(), count: logs.length, limit, offset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs.", detail: String(err) });
  }
});

router.delete("/", async (req, res) => {
  try {
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, req.params.projectId), eq(projectsTable.userId, req.user!.id)));

    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    await db.delete(logsTable).where(eq(logsTable.projectId, project.id));
    res.json({ message: "Logs cleared." });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear logs.", detail: String(err) });
  }
});

export default router;
