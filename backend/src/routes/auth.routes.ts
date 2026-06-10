import { Router } from "express";
import { AuthController, onboardSchoolSchema, loginSchema, refreshSchema } from "../controllers/auth.controller";
import { validateRequest } from "../middlewares/validation";
import { authenticateToken } from "../middlewares/auth";

const router = Router();
const controller = new AuthController();

router.post(
  "/onboard",
  validateRequest({ body: onboardSchoolSchema }),
  (req, res) => controller.onboard(req, res)
);

router.post(
  "/login",
  validateRequest({ body: loginSchema }),
  (req, res) => controller.login(req, res)
);

router.post(
  "/refresh",
  validateRequest({ body: refreshSchema }),
  (req, res) => controller.refresh(req, res)
);

router.post(
  "/logout",
  (req, res) => controller.logout(req, res)
);

router.get(
  "/me",
  authenticateToken as any, // type assertion for AuthenticatedRequest compatibility
  (req, res) => controller.me(req as any, res)
);

export default router;
