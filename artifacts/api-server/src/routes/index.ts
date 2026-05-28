import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import filesRouter from "./files";
import logsRouter from "./logs";
import aiRouter from "./ai";
import envVarsRouter from "./env-vars";
import adminRouter from "./admin";
import ngrokRouter from "./ngrok";
import apiKeysRouter from "./api-keys";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/files", filesRouter);
router.use("/projects/:projectId/logs", logsRouter);
router.use("/projects/:projectId/env", envVarsRouter);
router.use("/ai", aiRouter);
router.use("/admin", adminRouter);
router.use("/ngrok", ngrokRouter);
router.use("/keys", apiKeysRouter);

export default router;
