import { eq, and, sql } from "drizzle-orm";
import { db, DbClient } from "../db";
import { reportCards, ReportCard, students } from "../db/schema";

export interface UpsertReportCardInput {
  studentId: string;
  classId: string;
  academicYearId: string;
  term: number;
  classPosition?: number;
  aggregate?: number;
  promoted?: boolean;
  teacherRemarks?: string;
  headRemarks?: string;
  nextTermBegins?: string;
  publishedAt?: Date;
  pdfUrl?: string;
  status?: string;
}

export class ReportCardRepository {
  /**
   * Creates or updates a report card log.
   */
  async upsertReportCard(
    schoolId: string,
    input: UpsertReportCardInput,
    tx: DbClient = db
  ): Promise<ReportCard> {
    const value = {
      schoolId,
      studentId: input.studentId,
      classId: input.classId,
      academicYearId: input.academicYearId,
      term: input.term,
      classPosition: input.classPosition || null,
      aggregate: input.aggregate || null,
      promoted: input.promoted === undefined ? null : input.promoted,
      teacherRemarks: input.teacherRemarks || null,
      headRemarks: input.headRemarks || null,
      nextTermBegins: input.nextTermBegins || null,
      publishedAt: input.publishedAt || null,
      pdfUrl: input.pdfUrl || null,
      status: input.status || "pending",
    };

    const result = await tx
      .insert(reportCards)
      .values(value)
      .onConflictDoUpdate({
        target: [
          reportCards.schoolId,
          reportCards.studentId,
          reportCards.academicYearId,
          reportCards.term,
        ],
        set: {
          classId: value.classId,
          classPosition: sql`COALESCE(EXCLUDED.class_position, report_cards.class_position)`,
          aggregate: sql`COALESCE(EXCLUDED.aggregate, report_cards.aggregate)`,
          promoted: sql`COALESCE(EXCLUDED.promoted, report_cards.promoted)`,
          teacherRemarks: sql`COALESCE(EXCLUDED.teacher_remarks, report_cards.teacher_remarks)`,
          headRemarks: sql`COALESCE(EXCLUDED.head_remarks, report_cards.head_remarks)`,
          nextTermBegins: sql`COALESCE(EXCLUDED.next_term_begins, report_cards.next_term_begins)`,
          publishedAt: sql`COALESCE(EXCLUDED.published_at, report_cards.published_at)`,
          pdfUrl: sql`COALESCE(EXCLUDED.pdf_url, report_cards.pdf_url)`,
          status: sql`EXCLUDED.status`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return result[0];
  }

  /**
   * Retrieves a single report card log.
   */
  async getReportCard(
    schoolId: string,
    studentId: string,
    academicYearId: string,
    term: number,
    tx: DbClient = db
  ): Promise<ReportCard | null> {
    const result = await tx
      .select()
      .from(reportCards)
      .where(
        and(
          eq(reportCards.schoolId, schoolId),
          eq(reportCards.studentId, studentId),
          eq(reportCards.academicYearId, academicYearId),
          eq(reportCards.term, term)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Retrieves all report cards for a class in a term.
   */
  async listClassReportCards(
    schoolId: string,
    classId: string,
    academicYearId: string,
    term: number,
    tx: DbClient = db
  ) {
    return tx
      .select({
        id: reportCards.id,
        studentId: reportCards.studentId,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        classPosition: reportCards.classPosition,
        aggregate: reportCards.aggregate,
        promoted: reportCards.promoted,
        teacherRemarks: reportCards.teacherRemarks,
        headRemarks: reportCards.headRemarks,
        nextTermBegins: reportCards.nextTermBegins,
        pdfUrl: reportCards.pdfUrl,
        status: reportCards.status,
      })
      .from(reportCards)
      .innerJoin(students, eq(reportCards.studentId, students.id))
      .where(
        and(
          eq(reportCards.schoolId, schoolId),
          eq(reportCards.classId, classId),
          eq(reportCards.academicYearId, academicYearId),
          eq(reportCards.term, term)
        )
      );
  }

  /**
   * Fast status update helper.
   */
  async updateStatus(
    id: string,
    status: "pending" | "generating" | "completed" | "failed",
    pdfUrl?: string,
    tx: DbClient = db
  ): Promise<void> {
    const setClause: any = { status, updatedAt: new Date() };
    if (pdfUrl) {
      setClause.pdfUrl = pdfUrl;
      setClause.publishedAt = new Date();
    }

    await tx.update(reportCards).set(setClause).where(eq(reportCards.id, id));
  }
}
