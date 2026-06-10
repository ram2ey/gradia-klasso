import { Response } from "express";
import { z } from "zod";
import { FeeService } from "../services/fee.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const feeService = new FeeService();

export const createFeeStructureSchema = z.object({
  academicYearId: z.string().uuid("Invalid Academic Year ID"),
  term: z.number().min(1).max(3),
  classLevel: z.number().min(1).max(9),
  label: z.string().min(3, "Label must be at least 3 characters"),
  amount: z.number().positive("Amount must be a positive number"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export const assignFeeClassSchema = z.object({
  feeStructureId: z.string().uuid("Invalid Fee Structure ID"),
  classId: z.string().uuid("Invalid Class ID"),
});

export const payMoMoSchema = z.object({
  studentId: z.string().uuid("Invalid Student ID"),
  feeAssignmentId: z.string().uuid("Invalid Fee Assignment ID"),
  amount: z.number().positive("Amount must be positive"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  network: z.enum(["mtn", "telecel", "airteltigo"]),
});

export const payCashSchema = z.object({
  studentId: z.string().uuid("Invalid Student ID"),
  feeAssignmentId: z.string().uuid("Invalid Fee Assignment ID"),
  amount: z.number().positive("Amount must be positive"),
});

export class FeeController {
  /**
   * Registers a fee requirement model. (Headteacher restricted)
   */
  async createStructure(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const parsed = createFeeStructureSchema.parse(req.body);
      const result = await feeService.createFeeStructure(req.user.schoolId, parsed);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to create fee structure", 400);
    }
  }

  /**
   * Assigns a fee class-wide to active student rosters.
   */
  async assignClass(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const parsed = assignFeeClassSchema.parse(req.body);
      const result = await feeService.assignFeeToClass(req.user.schoolId, parsed);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to assign fees", 400);
    }
  }

  /**
   * Details structural balances, expectations, and logs for a single student.
   */
  async getStudentFees(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const result = await feeService.getStudentFeeDetails(req.user.schoolId, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch student fees", 400);
    }
  }

  /**
   * Initiates Mobile Money prompt checkpoints.
   */
  async payMoMo(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const parsed = payMoMoSchema.parse(req.body);
      
      const protocol = req.secure ? "https" : "http";
      const hostname = `${protocol}://${req.get("host")}`;

      const result = await feeService.payMobileMoney(req.user.schoolId, {
        ...parsed,
        hostname,
      });
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to initiate Mobile Money payment", 400);
    }
  }

  /**
   * Records cash settlements immediately. (Bursar restricted)
   */
  async payCash(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const parsed = payCashSchema.parse(req.body);
      const result = await feeService.payCash(req.user.schoolId, req.user.userId, parsed);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to log cash payment", 400);
    }
  }

  /**
   * Gathers filterable collections report log lines.
   */
  async getCollections(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const { classId, term, status } = req.query;
      const result = await feeService.getCollectionsReport(req.user.schoolId, {
        classId: classId ? String(classId) : undefined,
        term: term ? Number(term) : undefined,
        status: status ? String(status) : undefined,
      });
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch collections report", 400);
    }
  }

  /**
   * Compiles Puppeteer PDF receipts for printing.
   */
  async getReceipt(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const pdfBuffer = await feeService.generateReceiptPdf(req.user.schoolId, req.params.paymentId);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="receipt_${req.params.paymentId}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message || "Failed to render receipt PDF" });
    }
  }

  /**
   * expected, collected, outstanding aggregates.
   */
  async getDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const result = await feeService.getDashboardMetrics(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to retrieve dashboard metrics", 400);
    }
  }

  /**
   * Gathers outstanding debtor balances listing.
   */
  async getArrears(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const result = await feeService.getArrearsList(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to retrieve arrears list", 400);
    }
  }

  /**
   * Lists fee categories.
   */
  async getStructures(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const result = await feeService.listFeeStructures(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to retrieve fee structures", 400);
    }
  }

  /**
   * Retrieves academic years list.
   */
  async getAcademicYears(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, "Unauthorized", 401);
      const result = await feeService.listAcademicYears(req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to retrieve academic years", 400);
    }
  }
}
