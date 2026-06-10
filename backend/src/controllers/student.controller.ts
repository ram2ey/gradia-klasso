import { Request, Response } from "express";
import { z } from "zod";
import { StudentService } from "../services/student.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const studentService = new StudentService();

// Validation Schemas
export const enrolStudentSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  middleName: z.string().optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  dateOfBirth: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
  }, z.date({ invalid_type_error: "Invalid date format" })),
  gender: z.enum(["Male", "Female", "Other"]),
  emisNumber: z.string().optional(),
  guardianName: z.string().min(2, "Guardian name must be at least 2 characters"),
  guardianPhone: z.string().min(8, "Guardian phone must be at least 8 characters"),
  guardianEmail: z.string().email("Invalid guardian email").optional().or(z.literal("")),
  guardianRelationship: z.string().min(2, "Guardian relationship must be specified"),
  homeAddress: z.string().min(5, "Home address must be specified"),
  previousSchool: z.string().optional(),
  classId: z.string().uuid("Invalid Class Placement ID"),
  academicYearId: z.string().uuid("Invalid Academic Year ID").optional(),
});

export const updateStudentSchema = enrolStudentSchema.partial().omit({ classId: true, academicYearId: true });

export const transferStudentSchema = z.object({
  classId: z.string().uuid("Invalid Destination Class ID"),
  academicYearId: z.string().uuid("Invalid Academic Year ID").optional(),
});

export class StudentController {
  /**
   * Enrols a new student. (Headteacher only)
   */
  async enrol(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }
      
      const parsed = enrolStudentSchema.parse(req.body);
      const schoolId = req.user.schoolId;
      
      const result = await studentService.enrolStudent(
        schoolId,
        {
          firstName: parsed.firstName,
          middleName: parsed.middleName,
          lastName: parsed.lastName,
          dateOfBirth: parsed.dateOfBirth,
          gender: parsed.gender,
          emisNumber: parsed.emisNumber || undefined,
          guardianName: parsed.guardianName,
          guardianPhone: parsed.guardianPhone,
          guardianEmail: parsed.guardianEmail || undefined,
          guardianRelationship: parsed.guardianRelationship,
          homeAddress: parsed.homeAddress,
          previousSchool: parsed.previousSchool,
        },
        parsed.classId,
        parsed.academicYearId || ""
      );

      return sendSuccess(res, result, 201);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to enrol student", 400);
    }
  }

  /**
   * Lists students with search/filter query parameters.
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const { classId, academicYearId, search } = req.query;

      const result = await studentService.listStudents(schoolId, {
        classId: classId ? String(classId) : undefined,
        academicYearId: academicYearId ? String(academicYearId) : undefined,
        search: search ? String(search) : undefined,
      });

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to list students", 400);
    }
  }

  /**
   * Get student profile by ID.
   */
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.id;

      const result = await studentService.getStudentProfile(studentId, schoolId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to retrieve profile", 400);
    }
  }

  /**
   * Update student profile parameters.
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.id;
      const parsed = updateStudentSchema.parse(req.body);

      const result = await studentService.updateStudent(studentId, schoolId, parsed);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to update details", 400);
    }
  }

  /**
   * Handles student photo upload via Multer buffer.
   */
  async uploadPhoto(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }
      if (!req.file) {
        return sendError(res, "No photo file provided", 400);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.id;

      const result = await studentService.updateStudentPhoto(
        studentId,
        schoolId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to upload photo", 400);
    }
  }

  /**
   * Transfers student to a different class stream.
   */
  async transfer(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const studentId = req.params.id;
      const parsed = transferStudentSchema.parse(req.body);

      const result = await studentService.transferStudent(
        studentId,
        schoolId,
        parsed.classId,
        parsed.academicYearId || ""
      );

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to transfer student", 400);
    }
  }
}
export type EnrolStudentBody = z.infer<typeof enrolStudentSchema>;
