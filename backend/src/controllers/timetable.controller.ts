import { Response } from "express";
import { z } from "zod";
import { TimetableService } from "../services/timetable.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const timetableService = new TimetableService();

// Validation Schema for creating/updating slots
export const timetableEntrySchema = z.object({
  id: z.string().uuid("Invalid Entry ID").optional(),
  classId: z.string().uuid("Invalid Class ID"),
  subjectId: z.string().uuid("Invalid Subject ID"),
  teacherId: z.string().uuid("Invalid Teacher ID").nullable().optional().or(z.literal("")),
  dayOfWeek: z.number().int().min(1).max(5, "Day of week must be between 1 (Monday) and 5 (Friday)"),
  periodId: z.string().uuid("Invalid Period ID"),
});

export class TimetableController {
  /**
   * Retrieves full weekly schedule for a class.
   */
  async getClassSchedule(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const { classId } = req.params;
      if (!classId) {
        return sendError(res, "Class ID route parameter is required", 400);
      }

      const result = await timetableService.getClassTimetable(req.user.schoolId, classId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch class schedule", 400);
    }
  }

  /**
   * Retrieves full weekly schedule for a teacher.
   */
  async getTeacherSchedule(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const { teacherId } = req.params;
      if (!teacherId) {
        return sendError(res, "Teacher ID route parameter is required", 400);
      }

      const result = await timetableService.getTeacherTimetable(req.user.schoolId, teacherId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch teacher schedule", 400);
    }
  }

  /**
   * Add or Update a timetable entry slot.
   */
  async saveEntry(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const parsed = timetableEntrySchema.parse(req.body);
      const schoolId = req.user.schoolId;

      // Map empty string teacher ID to null (meaning unassigned teacher)
      const teacherId = parsed.teacherId === "" ? null : parsed.teacherId;

      const result = await timetableService.addOrUpdateEntry(schoolId, {
        id: parsed.id,
        classId: parsed.classId,
        subjectId: parsed.subjectId,
        teacherId,
        dayOfWeek: parsed.dayOfWeek,
        periodId: parsed.periodId,
      });

      return sendSuccess(res, result, parsed.id ? 200 : 201);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(res, error.errors[0]?.message || "Validation failed", 400);
      }
      return sendError(res, error.message || "Failed to save timetable slot", 400);
    }
  }

  /**
   * Remove a timetable slot entry.
   */
  async deleteEntry(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const { id } = req.params;
      if (!id) {
        return sendError(res, "Entry ID route parameter is required", 400);
      }

      await timetableService.deleteEntry(req.user.schoolId, id);
      return sendSuccess(res, { deleted: true }, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to delete slot", 400);
    }
  }

  /**
   * Detect and return any existing teacher clashes/conflicts.
   */
  async checkConflicts(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const result = await timetableService.getConflicts(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to audit conflicts", 400);
    }
  }

  /**
   * Get list of teachers in school context.
   */
  async listTeachers(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const result = await timetableService.getTeachers(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch teachers selection list", 400);
    }
  }
}
