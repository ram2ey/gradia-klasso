import { Response } from "express";
import { z } from "zod";
import { AttendanceService } from "../services/attendance.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const attendanceService = new AttendanceService();

// Validation Schemas
export const bulkSubmitSchema = z.object({
  classId: z.string().uuid("Invalid Class ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  session: z.enum(["morning", "afternoon"]),
  records: z.array(
    z.object({
      studentId: z.string().uuid("Invalid Student ID"),
      status: z.enum(["present", "absent", "late", "excused"]),
      note: z.string().optional(),
    })
  ).min(1, "Roster list cannot be empty"),
  forceOverride: z.boolean().optional().default(false),
});

export class AttendanceController {
  /**
   * Bulk records attendance for a class session.
   */
  async submit(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const parsed = bulkSubmitSchema.parse(req.body);
      const schoolId = req.user.schoolId;
      const recordedBy = req.user.userId;
      const userRole = req.user.role;

      const result = await attendanceService.submitClassAttendance(
        schoolId,
        recordedBy,
        userRole,
        parsed.classId,
        parsed.date,
        parsed.session,
        parsed.records,
        parsed.forceOverride
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      // Return custom warning payload structure if headteacher double mark warning triggers
      if (error.message.includes("WARNING")) {
        return sendError(res, error.message, 409, { warning: true });
      }
      return sendError(res, error.message || "Failed to record attendance", 400);
    }
  }

  /**
   * Gets attendance for a class on a date and session.
   */
  async getClassAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const classId = req.params.classId;
      const { date, session } = req.query;

      if (!date || !session) {
        return sendError(res, "Query parameters 'date' and 'session' are required", 400);
      }

      const result = await attendanceService.getClassAttendance(
        schoolId,
        classId,
        String(date),
        session as "morning" | "afternoon"
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch class attendance", 400);
    }
  }

  /**
   * Gets attendance history logs for a single student.
   */
  async getStudentHistory(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.studentId;
      const { from, to } = req.query;

      if (!from || !to) {
        return sendError(res, "Query parameters 'from' and 'to' are required", 400);
      }

      const result = await attendanceService.getStudentHistory(
        schoolId,
        studentId,
        String(from),
        String(to)
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch student history", 400);
    }
  }

  /**
   * Gets aggregated statistics per student in a class over a date range.
   */
  async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const classId = req.params.classId;
      const { from, to } = req.query;

      if (!from || !to) {
        return sendError(res, "Query parameters 'from' and 'to' are required", 400);
      }

      const result = await attendanceService.getClassSummary(
        schoolId,
        classId,
        String(from),
        String(to)
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch class summary", 400);
    }
  }
}
