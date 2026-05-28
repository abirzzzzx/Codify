import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { startNgrok, stopNgrok, reconnectNgrok, getNgrokStatus } from "../lib/ngrok";

const router = Router();

router.use(requireAuth);

router.get("/status", (_req, res) => {
  const status = getNgrokStatus();
  res.json(status);
});

router.post("/start", async (_req, res) => {
  try {
    const url = await startNgrok();
    if (!url) {
      res.status(503).json({ error: "Ngrok not available. Check NGROK_AUTHTOKEN." });
      return;
    }
    res.json({ message: "Ngrok tunnel started.", url });
  } catch (err) {
    res.status(500).json({ error: "Failed to start ngrok.", detail: String(err) });
  }
});

router.post("/stop", async (_req, res) => {
  try {
    await stopNgrok();
    res.json({ message: "Ngrok tunnel stopped." });
  } catch (err) {
    res.status(500).json({ error: "Failed to stop ngrok.", detail: String(err) });
  }
});

router.post("/reconnect", async (_req, res) => {
  try {
    const url = await reconnectNgrok();
    if (!url) {
      res.status(503).json({ error: "Ngrok reconnect failed. Check NGROK_AUTHTOKEN." });
      return;
    }
    res.json({ message: "Ngrok reconnected.", url });
  } catch (err) {
    res.status(500).json({ error: "Failed to reconnect ngrok.", detail: String(err) });
  }
});

export default router;
