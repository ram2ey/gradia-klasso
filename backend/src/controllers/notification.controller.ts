import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../types";
import { NotificationService } from "../services/notification.service";
import { sendSuccess, sendError } from "../utils/response";

const notificationService = new NotificationService();

// Validation schemas
const broadcastSchema = z.object({
  audience: z.enum(["all_parents", "class", "staff"]),
  classId: z.string().uuid().optional(),
  message: z.string().min(1).max(1000),
  title: z.string().min(1).max(255).optional(),
  channels: z.array(z.enum(["sms", "whatsapp", "in_app"])).min(1),
});

const smsBroadcastSchema = z.object({
  audience: z.enum(["all_parents", "class", "staff"]),
  classId: z.string().uuid().optional(),
  message: z.string().min(1).max(640),
});

export class NotificationController {
  /**
   * GET /notifications — Current user's in-app notifications.
   */
  async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Authentication required", 401);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await notificationService.getUserNotifications(
        req.user.schoolId,
        req.user.userId,
        page,
        Math.min(limit, 100)
      );

      return sendSuccess(res, result);
    } catch (error: any) {
      console.error("[NotificationController] getNotifications error:", error);
      return sendError(res, error.message || "Failed to fetch notifications", 500);
    }
  }

  /**
   * PUT /notifications/read-all — Mark all notifications as read.
   */
  async markAllRead(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Authentication required", 401);

      await notificationService.markAllRead(req.user.schoolId, req.user.userId);

      return sendSuccess(res, { message: "All notifications marked as read" });
    } catch (error: any) {
      console.error("[NotificationController] markAllRead error:", error);
      return sendError(res, error.message || "Failed to mark notifications as read", 500);
    }
  }

  /**
   * GET /notifications/stats — Returns unread count.
   */
  async getStats(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Authentication required", 401);

      const unreadCount = await notificationService.getUnreadCount(
        req.user.schoolId,
        req.user.userId
      );

      return sendSuccess(res, { unreadCount });
    } catch (error: any) {
      console.error("[NotificationController] getStats error:", error);
      return sendError(res, error.message || "Failed to fetch notification stats", 500);
    }
  }

  /**
   * POST /announcements — Headteacher broadcast to audience.
   */
  async broadcastAnnouncement(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Authentication required", 401);

      const parsed = broadcastSchema.safeParse(req.body);
      if (!parsed.success) {
        const issues = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        return sendError(res, `Validation failed: ${issues}`, 400);
      }

      const { audience, classId, message, title, channels } = parsed.data;

      // Validate classId is provided when audience is 'class'
      if (audience === "class" && !classId) {
        return sendError(res, "classId is required when audience is 'class'", 400);
      }

      const result = await notificationService.broadcastToAudience(req.user.schoolId, {
        audience,
        classId,
        message,
        title,
        channels: channels as any,
        type: "announcement",
      });

      return sendSuccess(res, result, 201);
    } catch (error: any) {
      console.error("[NotificationController] broadcastAnnouncement error:", error);
      return sendError(res, error.message || "Failed to broadcast announcement", 500);
    }
  }

  /**
   * POST /sms/broadcast — Bulk SMS to audience.
   */
  async smsBroadcast(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Authentication required", 401);

      const parsed = smsBroadcastSchema.safeParse(req.body);
      if (!parsed.success) {
        const issues = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        return sendError(res, `Validation failed: ${issues}`, 400);
      }

      const { audience, classId, message } = parsed.data;

      if (audience === "class" && !classId) {
        return sendError(res, "classId is required when audience is 'class'", 400);
      }

      const result = await notificationService.broadcastToAudience(req.user.schoolId, {
        audience,
        classId,
        message,
        channels: ["sms"],
        type: "announcement",
      });

      return sendSuccess(res, result, 201);
    } catch (error: any) {
      console.error("[NotificationController] smsBroadcast error:", error);
      return sendError(res, error.message || "Failed to send SMS broadcast", 500);
    }
  }

  /**
   * GET /notifications/delivery-log — Admin delivery job log.
   */
  async getDeliveryLog(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Authentication required", 401);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string | undefined;
      const channel = req.query.channel as string | undefined;

      const result = await notificationService.getDeliveryLogs(req.user.schoolId, {
        page,
        limit: Math.min(limit, 100),
        status,
        channel,
      });

      return sendSuccess(res, result);
    } catch (error: any) {
      console.error("[NotificationController] getDeliveryLog error:", error);
      return sendError(res, error.message || "Failed to fetch delivery log", 500);
    }
  }
}
