import { withSchoolContext, db } from "../db";
import { NotificationRepository } from "../repositories/notification.repository";
import { SmsService } from "./sms.service";
import { WhatsAppService } from "./whatsapp.service";
import { eq, and, sql, ne } from "drizzle-orm";
import {
  users,
  students,
  enrolments,
  attendanceRecords,
  feeAssignments,
  payments,
  classes,
  notifications as notificationsTable,
} from "../db/schema";
import type { NotificationType, NotificationChannel } from "../db/schema";

const notifRepo = new NotificationRepository();
const smsService = new SmsService();
const whatsAppService = new WhatsAppService();

export class NotificationService {
  /**
   * Creates an in-app notification and optionally dispatches via SMS/WhatsApp.
   */
  async notify(
    schoolId: string,
    input: {
      recipientUserId: string;
      title: string;
      body: string;
      type?: NotificationType;
      channels?: NotificationChannel[];
      recipientPhone?: string;
    }
  ) {
    // Create in-app notification
    await withSchoolContext(schoolId, async (tx) => {
      await notifRepo.createInAppNotification(
        schoolId,
        {
          recipientUserId: input.recipientUserId,
          title: input.title,
          body: input.body,
          type: input.type,
        },
        tx
      );
    });

    // Dispatch external channels in background
    const channels = input.channels || [];
    const phone = input.recipientPhone;

    if (phone && channels.includes("sms")) {
      setImmediate(() => {
        this.dispatchSms(schoolId, phone, input.body, input.recipientUserId).catch((err) =>
          console.error("[NotificationService] SMS dispatch error:", err)
        );
      });
    }

    if (phone && channels.includes("whatsapp")) {
      setImmediate(() => {
        this.dispatchWhatsApp(schoolId, phone, input.body, input.recipientUserId).catch((err) =>
          console.error("[NotificationService] WhatsApp dispatch error:", err)
        );
      });
    }
  }

  /**
   * Send SMS and log the job.
   */
  async dispatchSms(schoolId: string, phone: string, message: string, userId?: string) {
    const job = await withSchoolContext(schoolId, async (tx) => {
      return notifRepo.createJobLog(
        schoolId,
        {
          channel: "sms",
          recipientPhone: phone,
          recipientUserId: userId,
          message,
          status: "queued",
        },
        tx
      );
    });

    try {
      const success = await smsService.sendSms(phone, message);
      await withSchoolContext(schoolId, async (tx) => {
        await notifRepo.updateJobStatus(job.id, success ? "sent" : "failed", success ? undefined : "SMS delivery failed", tx);
      });
    } catch (err: any) {
      await withSchoolContext(schoolId, async (tx) => {
        await notifRepo.updateJobStatus(job.id, "failed", err.message || "SMS dispatch error", tx);
      });
    }
  }

  /**
   * Send WhatsApp message and log the job.
   */
  async dispatchWhatsApp(schoolId: string, phone: string, message: string, userId?: string) {
    const job = await withSchoolContext(schoolId, async (tx) => {
      return notifRepo.createJobLog(
        schoolId,
        {
          channel: "whatsapp",
          recipientPhone: phone,
          recipientUserId: userId,
          message,
          status: "queued",
        },
        tx
      );
    });

    try {
      const success = await whatsAppService.sendMessage(phone, message);
      await withSchoolContext(schoolId, async (tx) => {
        await notifRepo.updateJobStatus(job.id, success ? "sent" : "failed", success ? undefined : "WhatsApp delivery failed", tx);
      });
    } catch (err: any) {
      await withSchoolContext(schoolId, async (tx) => {
        await notifRepo.updateJobStatus(job.id, "failed", err.message || "WhatsApp dispatch error", tx);
      });
    }
  }

  /**
   * Broadcast a message to an audience.
   * Audience types: all_parents, class (requires classId), staff.
   * Creates in-app notifications for users and queues external channel jobs.
   */
  async broadcastToAudience(
    schoolId: string,
    input: {
      audience: "all_parents" | "class" | "staff";
      classId?: string;
      message: string;
      title?: string;
      channels: NotificationChannel[];
      type?: NotificationType;
    }
  ) {
    const recipients = await this.resolveAudienceRecipients(schoolId, input.audience, input.classId);

    if (recipients.length === 0) {
      return { success: true, count: 0, message: "No recipients matched the audience selection." };
    }

    const title = input.title || "School Announcement";
    const type = input.type || "announcement";

    // Create in-app notifications in bulk
    if (input.channels.includes("in_app")) {
      const userRecipients = recipients.filter((r) => r.userId);
      if (userRecipients.length > 0) {
        await withSchoolContext(schoolId, async (tx) => {
          await notifRepo.bulkCreateNotifications(
            schoolId,
            userRecipients.map((r) => ({
              recipientUserId: r.userId!,
              title,
              body: input.message,
              type,
            })),
            tx
          );
        });
      }
    }

    // Queue external dispatches
    let smsCount = 0;
    let whatsappCount = 0;

    for (const recipient of recipients) {
      if (!recipient.phone) continue;

      if (input.channels.includes("sms")) {
        smsCount++;
        setImmediate(() => {
          this.dispatchSms(schoolId, recipient.phone!, input.message, recipient.userId).catch((err) =>
            console.error("[NotificationService] Broadcast SMS error:", err)
          );
        });
      }

      if (input.channels.includes("whatsapp")) {
        whatsappCount++;
        setImmediate(() => {
          this.dispatchWhatsApp(schoolId, recipient.phone!, input.message, recipient.userId).catch((err) =>
            console.error("[NotificationService] Broadcast WhatsApp error:", err)
          );
        });
      }
    }

    return {
      success: true,
      count: recipients.length,
      smsQueued: smsCount,
      whatsappQueued: whatsappCount,
      message: `Broadcast dispatched to ${recipients.length} recipients.`,
    };
  }

  /**
   * Resolves phone numbers and user IDs from the database based on audience type.
   */
  private async resolveAudienceRecipients(
    schoolId: string,
    audience: "all_parents" | "class" | "staff",
    classId?: string
  ): Promise<{ phone: string | null; userId?: string }[]> {
    return withSchoolContext(schoolId, async (tx) => {
      if (audience === "staff") {
        const staffUsers = await tx
          .select({ id: users.id, phone: users.phone })
          .from(users)
          .where(
            and(
              eq(users.schoolId, schoolId),
              eq(users.isActive, true),
              sql`${users.role} IN ('headteacher', 'class_teacher', 'bursar')`
            )
          );

        return staffUsers.map((u) => ({ phone: u.phone, userId: u.id }));
      }

      if (audience === "class" && classId) {
        // Get guardian phones for students in the specific class
        const guardianPhones = await tx
          .select({
            guardianPhone: students.guardianPhone,
          })
          .from(students)
          .innerJoin(enrolments, eq(students.id, enrolments.studentId))
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(enrolments.classId, classId),
              eq(enrolments.status, "active")
            )
          );

        // Deduplicate phones
        const seen = new Set<string>();
        return guardianPhones
          .filter((g) => {
            if (!g.guardianPhone || seen.has(g.guardianPhone)) return false;
            seen.add(g.guardianPhone);
            return true;
          })
          .map((g) => ({ phone: g.guardianPhone }));
      }

      if (audience === "all_parents") {
        // Get all guardian phones from active enrolments
        const guardianPhones = await tx
          .select({
            guardianPhone: students.guardianPhone,
          })
          .from(students)
          .innerJoin(enrolments, eq(students.id, enrolments.studentId))
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(enrolments.status, "active")
            )
          );

        const seen = new Set<string>();
        return guardianPhones
          .filter((g) => {
            if (!g.guardianPhone || seen.has(g.guardianPhone)) return false;
            seen.add(g.guardianPhone);
            return true;
          })
          .map((g) => ({ phone: g.guardianPhone }));
      }

      return [];
    });
  }

  /**
   * Sends attendance alerts to parents of students marked absent yesterday.
   * Called by scheduled job (daily at 8 AM weekdays).
   */
  async sendAttendanceAlerts(schoolId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const absentRecords = await withSchoolContext(schoolId, async (tx) => {
      return tx
        .select({
          studentFirstName: students.firstName,
          studentLastName: students.lastName,
          guardianPhone: students.guardianPhone,
          className: classes.name,
          session: attendanceRecords.session,
        })
        .from(attendanceRecords)
        .innerJoin(students, eq(attendanceRecords.studentId, students.id))
        .innerJoin(classes, eq(attendanceRecords.classId, classes.id))
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.date, dateStr),
            eq(attendanceRecords.status, "absent")
          )
        );
    });

    if (absentRecords.length === 0) {
      console.log(`[NotificationService] No absent students found for ${dateStr}`);
      return;
    }

    // Group by guardian phone to avoid duplicate messages
    const byGuardian = new Map<string, string[]>();
    for (const record of absentRecords) {
      const phone = record.guardianPhone;
      const studentName = `${record.studentFirstName} ${record.studentLastName}`;
      if (!byGuardian.has(phone)) {
        byGuardian.set(phone, []);
      }
      byGuardian.get(phone)!.push(studentName);
    }

    for (const [phone, studentNames] of byGuardian) {
      const names = studentNames.join(", ");
      const message = `Dear Parent, your child/ward ${names} was marked absent from school on ${dateStr}. Please contact the school for follow-up. - Gradia Klasso`;

      setImmediate(() => {
        this.dispatchSms(schoolId, phone, message).catch((err) =>
          console.error("[NotificationService] Attendance alert SMS error:", err)
        );
      });
    }

    console.log(`[NotificationService] Sent attendance alerts to ${byGuardian.size} parents for ${dateStr}`);
  }

  /**
   * Sends fee reminders to parents with outstanding balances.
   * Called by scheduled job (weekly Monday at 8 AM).
   */
  async sendFeeReminders(schoolId: string) {
    const debtors = await withSchoolContext(schoolId, async (tx) => {
      // Get students with outstanding fee balances
      const assigned = await tx
        .select({
          studentId: feeAssignments.studentId,
          totalDue: sql<number>`SUM(${feeAssignments.amountDue}::numeric)`,
        })
        .from(feeAssignments)
        .where(eq(feeAssignments.schoolId, schoolId))
        .groupBy(feeAssignments.studentId);

      const paid = await tx
        .select({
          studentId: payments.studentId,
          totalPaid: sql<number>`SUM(${payments.amount}::numeric)`,
        })
        .from(payments)
        .where(and(eq(payments.schoolId, schoolId), eq(payments.status, "success")))
        .groupBy(payments.studentId);

      const paidMap = new Map(paid.map((p) => [p.studentId, p.totalPaid || 0]));

      const debtorStudentIds = assigned
        .filter((a) => {
          const paidAmount = paidMap.get(a.studentId) || 0;
          return (a.totalDue || 0) - paidAmount > 0;
        })
        .map((a) => ({
          studentId: a.studentId,
          outstanding: (a.totalDue || 0) - (paidMap.get(a.studentId) || 0),
        }));

      if (debtorStudentIds.length === 0) return [];

      // Fetch student details
      const studentDetails = await tx
        .select({
          id: students.id,
          firstName: students.firstName,
          lastName: students.lastName,
          guardianPhone: students.guardianPhone,
        })
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            sql`${students.id} IN (${sql.join(
              debtorStudentIds.map((d) => sql`${d.studentId}::uuid`),
              sql`, `
            )})`
          )
        );

      return debtorStudentIds.map((d) => {
        const student = studentDetails.find((s) => s.id === d.studentId);
        return {
          studentName: student ? `${student.firstName} ${student.lastName}` : "Student",
          guardianPhone: student?.guardianPhone || "",
          outstanding: d.outstanding,
        };
      });
    });

    if (debtors.length === 0) {
      console.log("[NotificationService] No students with outstanding fees found.");
      return;
    }

    // Group by guardian phone
    const byGuardian = new Map<string, { name: string; outstanding: number }[]>();
    for (const debtor of debtors) {
      if (!debtor.guardianPhone) continue;
      if (!byGuardian.has(debtor.guardianPhone)) {
        byGuardian.set(debtor.guardianPhone, []);
      }
      byGuardian.get(debtor.guardianPhone)!.push({
        name: debtor.studentName,
        outstanding: debtor.outstanding,
      });
    }

    for (const [phone, children] of byGuardian) {
      const lines = children.map((c) => `${c.name}: GHS ${c.outstanding.toFixed(2)}`).join("; ");
      const message = `Dear Parent, please note outstanding school fees: ${lines}. Kindly settle balances at the school bursary or via MoMo. Thank you. - Gradia Klasso`;

      setImmediate(() => {
        this.dispatchSms(schoolId, phone, message).catch((err) =>
          console.error("[NotificationService] Fee reminder SMS error:", err)
        );
      });
    }

    console.log(`[NotificationService] Sent fee reminders to ${byGuardian.size} parents.`);
  }

  /**
   * Sends report card published alerts to all parents in a class.
   * Called after report cards finish generating.
   */
  async sendReportCardAlerts(schoolId: string, classId: string) {
    const recipients = await this.resolveAudienceRecipients(schoolId, "class", classId);

    if (recipients.length === 0) return;

    const message =
      "Report cards for your child/ward are now ready! Please login to the Gradia Klasso portal to view and download the report card. - Gradia Klasso";

    for (const recipient of recipients) {
      if (!recipient.phone) continue;

      setImmediate(() => {
        this.dispatchSms(schoolId, recipient.phone!, message).catch((err) =>
          console.error("[NotificationService] Report card alert SMS error:", err)
        );
      });
    }

    console.log(`[NotificationService] Sent report card alerts to ${recipients.length} parents for class ${classId}`);
  }

  /**
   * Repository access wrappers for controllers.
   */
  async getUserNotifications(schoolId: string, userId: string, page: number, limit: number) {
    return withSchoolContext(schoolId, async (tx) => {
      return notifRepo.getUserNotifications(schoolId, userId, page, limit, tx);
    });
  }

  async markAllRead(schoolId: string, userId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      await notifRepo.markAllRead(schoolId, userId, tx);
    });
  }

  async getUnreadCount(schoolId: string, userId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return notifRepo.getUnreadCount(schoolId, userId, tx);
    });
  }

  async getDeliveryLogs(schoolId: string, filters: any) {
    return withSchoolContext(schoolId, async (tx) => {
      return notifRepo.listJobLogs(schoolId, filters, tx);
    });
  }
}
