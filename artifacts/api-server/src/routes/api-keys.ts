import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

router.get("/", async (req, res) => {
  try {
    const keys = await db
      .select({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        lastUsedAt: apiKeysTable.lastUsedAt,
        createdAt: apiKeysTable.createdAt,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, req.user!.id));

    res.json({ apiKeys: keys });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch API keys.", detail: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name } = req.body as Record<string, string>;
    if (!name) {
      res.status(400).json({ error: "name is required." });
      return;
    }

    const existing = await db
      .select({ id: apiKeysTable.id })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, req.user!.id));

    if (existing.length >= 10) {
      res.status(400).json({ error: "Maximum of 10 API keys allowed." });
      return;
    }

    const rawKey = `th_${randomBytes(32).toString("hex")}`;
    const keyHash = hashKey(rawKey);

    await db.insert(apiKeysTable).values({
      userId: req.user!.id,
      keyHash,
      name,
    });

    res.status(201).json({
      message: "API key created. Save the key — it will not be shown again.",
      key: rawKey,
      name,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create API key.", detail: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [key] = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.id, req.params.id), eq(apiKeysTable.userId, req.user!.id)));

    if (!key) {
      res.status(404).json({ error: "API key not found." });
      return;
    }

    await db.delete(apiKeysTable).where(eq(apiKeysTable.id, key.id));
    res.json({ message: "API key deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete API key.", detail: String(err) });
  }
});

export default router;
