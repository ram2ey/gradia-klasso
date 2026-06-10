import { Response } from "express";
import { SubjectRepository } from "../repositories/subject.repository";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";
import { withSchoolContext } from "../db";
import { ClassRepository } from "../repositories/class.repository";

const subjectRepo = new SubjectRepository();
const classRepo = new ClassRepository();

export class SubjectController {
  /**
   * Retrieves active subjects filterable by a class stream's level.
   */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }

      const schoolId = req.user.schoolId;
      const classId = req.query.classId as string;

      if (!classId) {
        const result = await withSchoolContext(schoolId, async (tx) => {
          return subjectRepo.list(schoolId, undefined, tx);
        });
        return sendSuccess(res, result, 200);
      }

      const result = await withSchoolContext(schoolId, async (tx) => {
        // Seed default NaCCA subjects if school has none
        await subjectRepo.seedDefaultSubjects(schoolId, tx);

        const classRecord = await classRepo.findById(classId, tx);
        if (!classRecord) {
          throw new Error("Class not found");
        }

        return subjectRepo.list(schoolId, { classLevel: classRecord.level }, tx);
      });

      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch subjects", 400);
    }
  }
}
