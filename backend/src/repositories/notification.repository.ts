import { eq, and, desc, sql } from "drizzle-orm";
import { db, DbClient } from "../db";
import { notifications, notificationJobs } from "../db/schema";
import type { NotificationType, NotificationChannel, NotificationJobStatus } from "../db/schema";

export class NotificationRepository {
  /**
   * Creates an in-app notification for a user.
   */
  async createInAppNotification(
    schoolId: string,
    input: {
      recipientUserId: string;
      title: string;
      body: string;
      type?: NotificationType;
    },
    tx: DbClient = db
  ) {
    const [result] = await tx
      .insert(notifications)
      .values({
        schoolId,
        recipientUserId: input.recipientUserId,
        title: input.title,
        body: input.body,
        type: input.type || "general",
      })
      .returning();
    return result;
  }

  /**
   * Bulk-create in-app notifications for multiple users.
   */
  async bulkCreateNotifications(
    schoolId: string,
    records: {
      recipientUserId: string;
      title: string;
      body: string;
      type?: NotificationType;
    }[],
    tx: DbClient = db
  ) {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      schoolId,
      recipientUserId: r.recipientUserId,
      title: r.title,
      body: r.body,
      type: r.type || ("general" as NotificationType),
    }));

    await tx.insert(notifications).values(values);
  }

  /**
   * Retrieves paginated notifications for a specific user.
   */
  async getUserNotifications(
    schoolId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
    tx: DbClient = db
  ) {
    const offset = (page - 1) * limit;

    const rows = await tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.schoolId, schoolId),
          eq(notifications.recipientUserId, userId)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.schoolId, schoolId),
          eq(notifications.recipientUserId, userId)
        )
      );

    return {
      notifications: rows,
      total: countResult?.count || 0,
      page,
      limit,
    };
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllRead(schoolId: string, userId: string, tx: DbClient = db) {
    await tx
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.schoolId, schoolId),
          eq(notifications.recipientUserId, userId),
          eq(notifications.isRead, false)
        )
      );
  }

  /**
   * Returns the unread notification count for a user.
   */
  async getUnreadCount(schoolId: string, userId: string, tx: DbClient = db) {
    const [result] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.schoolId, schoolId),
          eq(notifications.recipientUserId, userId),
          eq(notifications.isRead, false)
        )
      );
    return result?.count || 0;
  }

  /**
   * Creates a delivery job log entry.
   */
  async createJobLog(
    schoolId: string,
    input: {
      channel: NotificationChannel;
      recipientPhone?: string;
      recipientUserId?: string;
      message: string;
      status?: NotificationJobStatus;
    },
    tx: DbClient = db
  ) {
    const [result] = await tx
      .insert(notificationJobs)
      .values({
        schoolId,
        channel: input.channel,
        recipientPhone: input.recipientPhone || null,
        recipientUserId: input.recipientUserId || null,
        message: input.message,
        status: input.status || "queued",
      })
      .returning();
    return result;
  }

  /**
   * Updates a job log status to sent or failed.
   */
  async updateJobStatus(
    jobId: string,
    status: "sent" | "failed",
    error?: string,
    tx: DbClient = db
  ) {
    const updateData: any = {
      status,
    };
    if (status === "sent") {
      updateData.sentAt = new Date();
    }
    if (error) {
      updateData.error = error;
    }

    await tx
      .update(notificationJobs)
      .set(updateData)
      .where(eq(notificationJobs.id, jobId));
  }

  /**
   * Lists delivery job logs (admin view), paginated and filterable.
   */
  async listJobLogs(
    schoolId: string,
    filters: {
      status?: NotificationJobStatus;
      channel?: NotificationChannel;
      page?: number;
      limit?: number;
    } = {},
    tx: DbClient = db
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(notificationJobs.schoolId, schoolId)];

    if (filters.status) {
      conditions.push(eq(notificationJobs.status, filters.status));
    }
    if (filters.channel) {
      conditions.push(eq(notificationJobs.channel, filters.channel));
    }

    const rows = await tx
      .select()
      .from(notificationJobs)
      .where(and(...conditions))
      .orderBy(desc(notificationJobs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationJobs)
      .where(and(...conditions));

    return {
      jobs: rows,
      total: countResult?.count || 0,
      page,
      limit,
    };
  }
}
