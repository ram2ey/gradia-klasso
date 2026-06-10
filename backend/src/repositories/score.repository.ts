import { eq, and, sql } from "drizzle-orm";
import { db, DbClient } from "../db";
import { assessmentScores, students, subjects } from "../db/schema";

export interface BulkScoreInput {
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  term: number;
  classScore: number;
  examScore: number;
}

export class ScoreRepository {
  /**
   * Bulk upserts continuous assessment scores.
   * Leverages composite unique index on (schoolId, studentId, subjectId, academicYearId, term).
   * PostgreSQL trigger automatically recalculates NEW.total and NEW.grade based on classScore & examScore.
   */
  async bulkUpsert(
    schoolId: string,
    records: BulkScoreInput[],
    tx: DbClient = db
  ): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      schoolId,
      studentId: r.studentId,
      subjectId: r.subjectId,
      classId: r.classId,
      academicYearId: r.academicYearId,
      term: r.term,
      classScore: String(r.classScore), // numeric in schema maps to string in JS drizzle
      examScore: String(r.examScore),
      total: "0.00", // Overwritten by trigger in DB
      grade: "--",   // Overwritten by trigger in DB
    }));

    await tx
      .insert(assessmentScores)
      .values(values)
      .onConflictDoUpdate({
        target: [
          assessmentScores.schoolId,
          assessmentScores.studentId,
          assessmentScores.subjectId,
          assessmentScores.academicYearId,
          assessmentScores.term,
        ],
        set: {
          classScore: sql`EXCLUDED.class_score`,
          examScore: sql`EXCLUDED.exam_score`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  /**
   * Retrieves scores for a class, academic year, and term.
   * Returns details joined with student and subject names.
   */
  async listClassScores(
    schoolId: string,
    classId: string,
    academicYearId: string,
    term: number,
    tx: DbClient = db
  ) {
    return tx
      .select({
        id: assessmentScores.id,
        studentId: assessmentScores.studentId,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        subjectId: assessmentScores.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        classScore: assessmentScores.classScore,
        examScore: assessmentScores.examScore,
        total: assessmentScores.total,
        grade: assessmentScores.grade,
      })
      .from(assessmentScores)
      .innerJoin(students, eq(assessmentScores.studentId, students.id))
      .innerJoin(subjects, eq(assessmentScores.subjectId, subjects.id))
      .where(
        and(
          eq(assessmentScores.schoolId, schoolId),
          eq(assessmentScores.classId, classId),
          eq(assessmentScores.academicYearId, academicYearId),
          eq(assessmentScores.term, term)
        )
      );
  }

  /**
   * Retrieves all scores for a student, academic year, and term.
   */
  async listStudentScores(
    schoolId: string,
    studentId: string,
    academicYearId: string,
    term: number,
    tx: DbClient = db
  ) {
    return tx
      .select({
        id: assessmentScores.id,
        subjectId: assessmentScores.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        classScore: assessmentScores.classScore,
        examScore: assessmentScores.examScore,
        total: assessmentScores.total,
        grade: assessmentScores.grade,
      })
      .from(assessmentScores)
      .innerJoin(subjects, eq(assessmentScores.subjectId, subjects.id))
      .where(
        and(
          eq(assessmentScores.schoolId, schoolId),
          eq(assessmentScores.studentId, studentId),
          eq(assessmentScores.academicYearId, academicYearId),
          eq(assessmentScores.term, term)
        )
      );
  }
}
