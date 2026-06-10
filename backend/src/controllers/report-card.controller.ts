import { Response } from "express";
import { z } from "zod";
import { ReportCardService } from "../services/report-card.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const reportCardService = new ReportCardService();

export const generateReportCardsSchema = z.object({
  classId: z.string().uuid("Invalid Class ID"),
  academicYearId: z.string().uuid("Invalid Academic Year ID"),
  term: z.number().min(1).max(3, "Term must be 1, 2, or 3"),
  termStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  termEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  nextTermBegins: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
});

export const updateRemarksSchema = z.object({
  studentId: z.string().uuid("Invalid Student ID"),
  classId: z.string().uuid("Invalid Class ID"),
  academicYearId: z.string().uuid("Invalid Academic Year ID"),
  term: z.number().min(1).max(3, "Term must be 1, 2, or 3"),
  teacherRemarks: z.string().optional(),
  headRemarks: z.string().optional(),
  promoted: z.boolean().optional(),
});

export class ReportCardController {
  /**
   * Triggers the asynchronous background PDF generation.
   */
  async generate(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const parsed = generateReportCardsSchema.parse(req.body);
      const schoolId = req.user.schoolId;

      const result = await reportCardService.generateReportCards(schoolId, parsed);
      return sendSuccess(res, result, 202);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to trigger report cards generation", 400);
    }
  }

  /**
   * Retrieves status or pdfUrl of a single report card.
   */
  async getStudentReportCard(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.studentId;
      const { academicYearId, term } = req.query;

      if (!academicYearId || !term) {
        return sendError(res, "Query parameters 'academicYearId' and 'term' are required", 400);
      }

      const result = await reportCardService.getStudentReportCard(
        schoolId,
        studentId,
        String(academicYearId),
        Number(term)
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch report card", 400);
    }
  }

  /**
   * Retrieves generated report list details for a class stream.
   */
  async getClassReportCards(req: AuthenticatedRequest, res: Response) {
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

      const result = await reportCardService.getClassReportCards(
        schoolId,
        classId,
        String(academicYearId),
        Number(term)
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch class report cards", 400);
    }
  }

  /**
   * Directly saves or updates remarks comments/remarks.
   */
  async updateRemarks(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const parsed = updateRemarksSchema.parse(req.body);
      const schoolId = req.user.schoolId;

      const result = await reportCardService.updateReportRemarks(schoolId, parsed);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to update report card remarks", 400);
    }
  }

  async getSchoolSettings(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }
      const result = await reportCardService.getSchoolSettings(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch school settings", 400);
    }
  }

  async uploadSchoolAsset(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }
      if (!req.file) {
        return sendError(res, "No file provided", 400);
      }
      const { type } = req.query;
      if (!type || !["logo", "signature", "stamp"].includes(String(type))) {
        return sendError(res, "Invalid asset type query parameter. Must be logo, signature, or stamp", 400);
      }

      const result = await reportCardService.updateSchoolAsset(
        req.user.schoolId,
        type as any,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to upload school asset", 400);
    }
  }
}
