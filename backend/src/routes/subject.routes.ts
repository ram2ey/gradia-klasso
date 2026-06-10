import { Router } from "express";
import { SubjectController } from "../controllers/subject.controller";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new SubjectController();

router.use(authenticateToken as any);

router.get(
  "/",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.list(req as any, res)
);

export default router;
