import { Router } from "express";
import { ClassController, createClassSchema } from "../controllers/class.controller";
import { validateRequest } from "../middlewares/validation";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new ClassController();

router.use(authenticateToken as any);

router.post(
  "/",
  requireRole("headteacher"),
  validateRequest({ body: createClassSchema }),
  (req, res) => controller.create(req as any, res)
);

router.get(
  "/",
  requireRole("headteacher", "class_teacher", "bursar"),
  (req, res) => controller.list(req as any, res)
);

export default router;
