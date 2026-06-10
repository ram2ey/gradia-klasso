import { Response } from "express";
import { z } from "zod";
import { ScoreService } from "../services/score.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const scoreService = new ScoreService();

export const bulkSubmitScoresSchema = z.object({
  classId: z.string().uuid("Invalid Class ID"),
  academicYearId: z.string().uuid("Invalid Academic Year ID"),
  term: z.number().min(1).max(3, "Term must be 1, 2, or 3"),
  subjectId: z.string().uuid("Invalid Subject ID"),
  records: z.array(
    z.object({
      studentId: z.string().uuid("Invalid Student ID"),
      classScore: z.number().min(0).max(100, "Class score must be between 0 and 100"),
      examScore: z.number().min(0).max(100, "Exam score must be between 0 and 100"),
    })
  ).min(1, "Roster cannot be empty"),
});

export class ScoreController {
  /**
   * Bulk records continuous grades for a roster.
   */
  async bulkSubmit(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const parsed = bulkSubmitScoresSchema.parse(req.body);
      const schoolId = req.user.schoolId;

      const result = await scoreService.bulkSubmitScores(schoolId, parsed);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to submit scores", 400);
    }
  }

  /**
   * Fetches the continuous scores matching a class term.
   */
  async getClassScores(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const classId = req.params.classId;
      const { academicYearId, term } = req.query;

      if (!academicYearId || !term) {
        return sendError(res, "Query parameters 'academicYearId' and 'term' are required", 400);
      }

      const result = await scoreService.getClassScores(
        schoolId,
        classId,
        String(academicYearId),
        Number(term)
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch class scores", 400);
    }
  }

  /**
   * Fetches scores recorded for a single student term.
   */
  async getStudentScores(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.id;
      const { academicYearId, term } = req.query;

      if (!academicYearId || !term) {
        return sendError(res, "Query parameters 'academicYearId' and 'term' are required", 400);
      }

      const result = await scoreService.getStudentScores(
        schoolId,
        studentId,
        String(academicYearId),
        Number(term)
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch student scores", 400);
    }
  }
}
