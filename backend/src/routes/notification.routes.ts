import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth";
import { NotificationController } from "../controllers/notification.controller";

const router = Router();
const controller = new NotificationController();

// All routes require authentication
router.use(authenticateToken);

// GET /notifications — Current user's notifications (all roles)
router.get("/", (req, res) => controller.getNotifications(req as any, res));

// GET /notifications/stats — Unread count (all roles)
router.get("/stats", (req, res) => controller.getStats(req as any, res));

// PUT /notifications/read-all — Mark all as read (all roles)
router.put("/read-all", (req, res) => controller.markAllRead(req as any, res));

// POST /announcements — Broadcast announcement (headteacher only)
router.post(
  "/announcements",
  requireRole("headteacher"),
  (req, res) => controller.broadcastAnnouncement(req as any, res)
);

// POST /sms/broadcast — Bulk SMS (headteacher only)
router.post(
  "/sms/broadcast",
  requireRole("headteacher"),
  (req, res) => controller.smsBroadcast(req as any, res)
);

// GET /notifications/delivery-log — Admin delivery log (headteacher, bursar)
router.get(
  "/delivery-log",
  requireRole("headteacher", "bursar"),
  (req, res) => controller.getDeliveryLog(req as any, res)
);

export default router;
