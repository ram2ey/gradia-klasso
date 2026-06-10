import { Router } from "express";
import { AttendanceController, bulkSubmitSchema } from "../controllers/attendance.controller";
import { validateRequest } from "../middlewares/validation";
import { authenticateToken } from "../middlewares/auth";

const router = Router();
const controller = new AttendanceController();

router.use(authenticateToken as any);

router.post(
  "/bulk",
  validateRequest({ body: bulkSubmitSchema }),
  (req, res) => controller.submit(req as any, res)
);

router.get(
  "/class/:classId",
  (req, res) => controller.getClassAttendance(req as any, res)
);

router.get(
  "/student/:studentId",
  (req, res) => controller.getStudentHistory(req as any, res)
);

router.get(
  "/summary/:classId",
  (req, res) => controller.getSummary(req as any, res)
);

export default router;
