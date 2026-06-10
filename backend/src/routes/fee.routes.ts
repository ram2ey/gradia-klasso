import { Router } from "express";
import { FeeController } from "../controllers/fee.controller";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new FeeController();

// Protect all routes with JWT auth
router.use(authenticateToken as any);

router.post(
  "/structures",
  requireRole("headteacher"),
  (req, res) => controller.createStructure(req as any, res)
);

router.get(
  "/structures",
  requireRole("headteacher", "bursar", "class_teacher"),
  (req, res) => controller.getStructures(req as any, res)
);

router.post(
  "/assign-class",
  requireRole("headteacher"),
  (req, res) => controller.assignClass(req as any, res)
);

router.get(
  "/student/:id",
  requireRole("headteacher", "class_teacher", "bursar", "parent", "student"),
  (req, res) => controller.getStudentFees(req as any, res)
);

router.post(
  "/pay/momo",
  requireRole("headteacher", "class_teacher", "bursar", "parent", "student"),
  (req, res) => controller.payMoMo(req as any, res)
);

router.post(
  "/pay/cash",
  requireRole("bursar"),
  (req, res) => controller.payCash(req as any, res)
);

router.get(
  "/collections",
  requireRole("headteacher", "bursar"),
  (req, res) => controller.getCollections(req as any, res)
);

router.get(
  "/receipt/:paymentId",
  requireRole("headteacher", "class_teacher", "bursar", "parent", "student"),
  (req, res) => controller.getReceipt(req as any, res)
);

router.get(
  "/dashboard",
  requireRole("headteacher", "bursar"),
  (req, res) => controller.getDashboard(req as any, res)
);

router.get(
  "/arrears",
  requireRole("headteacher", "bursar"),
  (req, res) => controller.getArrears(req as any, res)
);

router.get(
  "/academic-years",
  requireRole("headteacher", "bursar", "class_teacher", "parent", "student"),
  (req, res) => controller.getAcademicYears(req as any, res)
);

export default router;
