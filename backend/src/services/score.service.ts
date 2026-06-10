import { withSchoolContext } from "../db";
import { ScoreRepository, BulkScoreInput } from "../repositories/score.repository";
import { SubjectRepository } from "../repositories/subject.repository";

const scoreRepo = new ScoreRepository();
const subjectRepo = new SubjectRepository();

export class ScoreService {
  /**
   * Bulk records Continuous Assessment scores for a class, subject, and term.
   */
  async bulkSubmitScores(
    schoolId: string,
    input: {
      classId: string;
      academicYearId: string;
      term: number;
      subjectId: string;
      records: {
        studentId: string;
        classScore: number;
        examScore: number;
      }[];
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      // Seed default subjects if not already done, just as an onboarding helper
      await subjectRepo.seedDefaultSubjects(schoolId, tx);

      const mappedRecords: BulkScoreInput[] = input.records.map((r) => ({
        studentId: r.studentId,
        subjectId: input.subjectId,
        classId: input.classId,
        academicYearId: input.academicYearId,
        term: input.term,
        classScore: r.classScore,
        examScore: r.examScore,
      }));

      await scoreRepo.bulkUpsert(schoolId, mappedRecords, tx);

      return {
        success: true,
        message: `Successfully updated scores for ${input.records.length} students.`,
      };
    });
  }

  /**
   * Lists scores for a class stream.
   */
  async getClassScores(schoolId: string, classId: string, academicYearId: string, term: number) {
    return withSchoolContext(schoolId, async (tx) => {
      return scoreRepo.listClassScores(schoolId, classId, academicYearId, term, tx);
    });
  }

  /**
   * Lists scores for a single student.
   */
  async getStudentScores(schoolId: string, studentId: string, academicYearId: string, term: number) {
    return withSchoolContext(schoolId, async (tx) => {
      return scoreRepo.listStudentScores(schoolId, studentId, academicYearId, term, tx);
    });
  }
}
