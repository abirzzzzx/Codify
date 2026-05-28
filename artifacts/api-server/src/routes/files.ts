import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireVerified } from "../middlewares/auth";
import { uploadLimiter } from "../middlewares/rate-limit";
import { getProjectDir, ensureProjectDir } from "../lib/process-manager";

const router = Router({ mergeParams: true });

const PROJECTS_DIR = process.env.PROJECTS_DIR ?? path.join(process.cwd(), "projects");
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? "5242880"); // 5 MB default
const ALLOWED_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".pyw",
  ".json", ".yaml", ".yml", ".toml",
  ".env", ".txt", ".md", ".html", ".css",
  ".sh", ".bash",
  ".xml", ".csv",
]);

router.use(requireVerified);

function sanitizePath(base: string, userPath: string): string | null {
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve(base, normalized);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
    return null;
  }
  return resolved;
}

async function getProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return project ?? null;
}

function buildFileTree(dir: string, base: string): unknown[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.name !== "node_modules" && e.name !== "__pycache__" && e.name !== ".git")
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(base, fullPath);
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: relativePath,
          type: "directory",
          children: buildFileTree(fullPath, base),
        };
      }
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        path: relativePath,
        type: "file",
        size: stat.size,
        modifiedAt: stat.mtime,
      };
    });
}

router.get("/", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    ensureProjectDir(project.userId, project.name);

    const tree = buildFileTree(projectDir, projectDir);
    res.json({ files: tree });
  } catch (err) {
    res.status(500).json({ error: "Failed to list files.", detail: String(err) });
  }
});

router.get("/content", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter is required." });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    const safePath = sanitizePath(projectDir, filePath);
    if (!safePath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }

    if (!fs.existsSync(safePath)) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      res.status(400).json({ error: "Path is a directory." });
      return;
    }

    if (stat.size > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File too large to read." });
      return;
    }

    const content = fs.readFileSync(safePath, "utf-8");
    res.json({ content, path: filePath, size: stat.size, modifiedAt: stat.mtime });
  } catch (err) {
    res.status(500).json({ error: "Failed to read file.", detail: String(err) });
  }
});

router.put("/content", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const { path: filePath, content } = req.body as { path: string; content: string };
    if (!filePath || content === undefined) {
      res.status(400).json({ error: "path and content are required." });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      res.status(400).json({ error: `File extension '${ext}' is not allowed.` });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    const safePath = sanitizePath(projectDir, filePath);
    if (!safePath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }

    if (Buffer.byteLength(content, "utf-8") > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File content too large." });
      return;
    }

    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, content, "utf-8");

    res.json({ message: "File saved.", path: filePath });
  } catch (err) {
    res.status(500).json({ error: "Failed to write file.", detail: String(err) });
  }
});

router.delete("/content", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter is required." });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    const safePath = sanitizePath(projectDir, filePath);
    if (!safePath) {
      res.status(400).json({ error: "Invalid file path." });
      return;
    }

    if (!fs.existsSync(safePath)) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      fs.rmdirSync(safePath, { recursive: true });
    } else {
      fs.unlinkSync(safePath);
    }

    res.json({ message: "Deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete file.", detail: String(err) });
  }
});

router.post("/mkdir", async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const { path: dirPath } = req.body as { path: string };
    if (!dirPath) {
      res.status(400).json({ error: "path is required." });
      return;
    }

    const projectDir = getProjectDir(project.userId, project.name);
    const safePath = sanitizePath(projectDir, dirPath);
    if (!safePath) {
      res.status(400).json({ error: "Invalid directory path." });
      return;
    }

    fs.mkdirSync(safePath, { recursive: true });
    res.json({ message: "Directory created." });
  } catch (err) {
    res.status(500).json({ error: "Failed to create directory.", detail: String(err) });
  }
});

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const projectId = req.params.projectId;
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.id)));
    if (!project) {
      cb(new Error("Project not found."), "");
      return;
    }
    const uploadDir = getProjectDir(project.userId, project.name);
    const subdir = (req.query.dir as string) ?? "";
    const targetDir = subdir
      ? path.join(uploadDir, path.normalize(subdir).replace(/^(\.\.(\/|\\|$))+/, ""))
      : uploadDir;
    fs.mkdirSync(targetDir, { recursive: true });
    (req as Record<string, unknown>)._uploadDir = uploadDir;
    (req as Record<string, unknown>)._targetDir = targetDir;
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname.replace(/[^a-zA-Z0-9._\-]/g, "_"));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`File extension '${ext}' is not allowed.`));
      return;
    }
    cb(null, true);
  },
});

router.post("/upload", uploadLimiter, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    res.json({
      message: "File uploaded.",
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: "Upload failed.", detail: String(err) });
  }
});

export default router;
