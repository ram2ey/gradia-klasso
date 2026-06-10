import { Router } from "express";
import { TimetableController } from "../controllers/timetable.controller";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new TimetableController();

// All timetable endpoints require authentication
router.use(authenticateToken as any);

router.get(
  "/class/:classId",
  requireRole("headteacher", "class_teacher", "bursar", "parent", "student"),
  (req, res) => controller.getClassSchedule(req as any, res)
);

router.get(
  "/teacher/:teacherId",
  requireRole("headteacher", "class_teacher", "parent", "student"),
  (req, res) => controller.getTeacherSchedule(req as any, res)
);

router.post(
  "/entry",
  requireRole("headteacher"),
  (req, res) => controller.saveEntry(req as any, res)
);

router.delete(
  "/entry/:id",
  requireRole("headteacher"),
  (req, res) => controller.deleteEntry(req as any, res)
);

router.get(
  "/conflicts",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.checkConflicts(req as any, res)
);

router.get(
  "/teachers",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.listTeachers(req as any, res)
);

export default router;
