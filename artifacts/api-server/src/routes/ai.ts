import { Router } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireVerified } from "../middlewares/auth";
import { aiLimiter } from "../middlewares/rate-limit";
import { debugCode, generateCode, explainError, editCode, addImports, generateTemplate } from "../lib/ai";
import { getProjectDir } from "../lib/process-manager";

const router = Router();

router.use(requireVerified, aiLimiter);

const MAX_FILE_SIZE = 32768;

function sanitizePath(base: string, userPath: string): string | null {
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve(base, normalized);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
    return null;
  }
  return resolved;
}

async function getProjectDir_(projectId: string, userId: string): Promise<{ dir: string; project: { id: string; name: string; userId: string; type: string } } | null> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  if (!project) return null;
  return { dir: getProjectDir(project.userId, project.name), project };
}

router.post("/debug", async (req, res) => {
  try {
    const { projectId, filePath, error, language } = req.body as Record<string, string>;
    if (!projectId || !filePath || !error || !language) {
      res.status(400).json({ error: "projectId, filePath, error, and language are required." });
      return;
    }

    const result = await getProjectDir_(projectId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const safePath = sanitizePath(result.dir, filePath);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    const stat = fs.statSync(safePath);
    if (stat.size > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File too large for AI analysis." });
      return;
    }

    const code = fs.readFileSync(safePath, "utf-8");
    const aiResult = await debugCode(code, error, language);

    let parsed;
    try { parsed = JSON.parse(aiResult); } catch { parsed = { raw: aiResult }; }

    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: "AI debug failed.", detail: String(err) });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { projectId, filename, description, language } = req.body as Record<string, string>;
    if (!projectId || !filename || !description || !language) {
      res.status(400).json({ error: "projectId, filename, description, and language are required." });
      return;
    }

    const result = await getProjectDir_(projectId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const safePath = sanitizePath(result.dir, filename);
    if (!safePath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }

    const aiResult = await generateCode(description, language, filename);
    let parsed: { code?: string; explanation?: string; raw?: string };
    try { parsed = JSON.parse(aiResult); } catch { parsed = { raw: aiResult }; }

    if (parsed.code) {
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, parsed.code, "utf-8");
    }

    res.json({ result: parsed, saved: !!parsed.code });
  } catch (err) {
    res.status(500).json({ error: "AI generate failed.", detail: String(err) });
  }
});

router.post("/explain", async (req, res) => {
  try {
    const { error, context } = req.body as Record<string, string>;
    if (!error) {
      res.status(400).json({ error: "error is required." });
      return;
    }

    const aiResult = await explainError(error, context ?? "");
    let parsed;
    try { parsed = JSON.parse(aiResult); } catch { parsed = { raw: aiResult }; }

    res.json({ result: parsed });
  } catch (err) {
    res.status(500).json({ error: "AI explain failed.", detail: String(err) });
  }
});

router.post("/edit", async (req, res) => {
  try {
    const { projectId, filePath, instruction, language } = req.body as Record<string, string>;
    if (!projectId || !filePath || !instruction || !language) {
      res.status(400).json({ error: "projectId, filePath, instruction, and language are required." });
      return;
    }

    const result = await getProjectDir_(projectId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const safePath = sanitizePath(result.dir, filePath);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    const stat = fs.statSync(safePath);
    if (stat.size > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File too large for AI editing." });
      return;
    }

    const code = fs.readFileSync(safePath, "utf-8");
    const aiResult = await editCode(code, instruction, language);
    let parsed: { editedCode?: string; changes?: string[]; raw?: string };
    try { parsed = JSON.parse(aiResult); } catch { parsed = { raw: aiResult }; }

    if (parsed.editedCode) {
      fs.writeFileSync(safePath, parsed.editedCode, "utf-8");
    }

    res.json({ result: parsed, saved: !!parsed.editedCode });
  } catch (err) {
    res.status(500).json({ error: "AI edit failed.", detail: String(err) });
  }
});

router.post("/imports", async (req, res) => {
  try {
    const { projectId, filePath, language } = req.body as Record<string, string>;
    if (!projectId || !filePath || !language) {
      res.status(400).json({ error: "projectId, filePath, and language are required." });
      return;
    }

    const result = await getProjectDir_(projectId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const safePath = sanitizePath(result.dir, filePath);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    const code = fs.readFileSync(safePath, "utf-8");
    const aiResult = await addImports(code, language);
    let parsed: { updatedCode?: string; addedImports?: string[]; raw?: string };
    try { parsed = JSON.parse(aiResult); } catch { parsed = { raw: aiResult }; }

    if (parsed.updatedCode) {
      fs.writeFileSync(safePath, parsed.updatedCode, "utf-8");
    }

    res.json({ result: parsed, saved: !!parsed.updatedCode });
  } catch (err) {
    res.status(500).json({ error: "AI imports failed.", detail: String(err) });
  }
});

router.post("/template", async (req, res) => {
  try {
    const { projectId, projectType } = req.body as Record<string, string>;
    if (!projectId || !projectType) {
      res.status(400).json({ error: "projectId and projectType are required." });
      return;
    }

    const result = await getProjectDir_(projectId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const aiResult = await generateTemplate(projectType, result.project.name);
    let parsed: { files?: Array<{ filename: string; content: string }>; instructions?: string; raw?: string };
    try { parsed = JSON.parse(aiResult); } catch { parsed = { raw: aiResult }; }

    if (parsed.files && Array.isArray(parsed.files)) {
      for (const file of parsed.files) {
        if (!file.filename || typeof file.content !== "string") continue;
        const safePath = sanitizePath(result.dir, file.filename);
        if (!safePath) continue;
        fs.mkdirSync(path.dirname(safePath), { recursive: true });
        fs.writeFileSync(safePath, file.content, "utf-8");
      }
    }

    res.json({ result: parsed, filesCreated: parsed.files?.length ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "AI template failed.", detail: String(err) });
  }
});

export default router;
