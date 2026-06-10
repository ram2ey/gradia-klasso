import { Router } from "express";
import { ScoreController } from "../controllers/score.controller";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new ScoreController();

router.use(authenticateToken as any);

router.post(
  "/bulk",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.bulkSubmit(req as any, res)
);

router.get(
  "/class/:classId",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.getClassScores(req as any, res)
);

router.get(
  "/student/:id",
  requireRole("headteacher", "class_teacher", "parent", "student"),
  (req, res) => controller.getStudentScores(req as any, res)
);

export default router;
