import { Request, Response } from "express";
import { z } from "zod";
import { ClassService } from "../services/class.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const classService = new ClassService();

// Validation Schemas
export const createClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters"),
  level: z.number().int().min(1).max(9, "Level must be between 1 (Basic 1) and 9 (JHS 3)"),
  classTeacherId: z.string().uuid("Invalid Teacher ID").optional().or(z.literal("")),
});

export class ClassController {
  /**
   * Creates a new class stream (e.g. Basic 3B). (Headteacher only)
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const parsed = createClassSchema.parse(req.body);
      const schoolId = req.user.schoolId;

      const result = await classService.createClass(
        schoolId,
        parsed.name,
        parsed.level,
        parsed.classTeacherId || undefined
      );

      return sendSuccess(res, result, 201);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to create class", 400);
    }
  }

  /**
   * Lists class streams for the active year.
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const { academicYearId } = req.query;

      const result = await classService.listClasses(
        schoolId,
        academicYearId ? String(academicYearId) : undefined
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to list classes", 400);
    }
  }
}
