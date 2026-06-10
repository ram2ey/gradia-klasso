import { eq, and, sql, desc, sum, like } from "drizzle-orm";
import { db, DbClient } from "../db";
import {
  feeStructures,
  feeAssignments,
  payments,
  students,
  enrolments,
  classes,
  users,
} from "../db/schema";

export class FeeRepository {
  /**
   * Creates a new fee structure category.
   */
  async createFeeStructure(
    schoolId: string,
    input: typeof feeStructures.$inferInsert,
    tx: DbClient = db
  ) {
    const [result] = await tx
      .insert(feeStructures)
      .values({ ...input, schoolId })
      .returning();
    return result;
  }

  /**
   * Assigns a fee structure to a student.
   */
  async assignFeeToStudent(
    schoolId: string,
    input: typeof feeAssignments.$inferInsert,
    tx: DbClient = db
  ) {
    const [result] = await tx
      .insert(feeAssignments)
      .values({ ...input, schoolId })
      .returning();
    return result;
  }

  /**
   * Bulk assigns a fee structure to students in a class stream.
   */
  async bulkAssignFeeToStudents(
    schoolId: string,
    records: {
      studentId: string;
      feeStructureId: string;
      academicYearId: string;
      term: number;
      amountDue: string;
    }[],
    tx: DbClient = db
  ) {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      schoolId,
      studentId: r.studentId,
      feeStructureId: r.feeStructureId,
      academicYearId: r.academicYearId,
      term: r.term,
      amountDue: r.amountDue,
    }));

    await tx
      .insert(feeAssignments)
      .values(values)
      .onConflictDoNothing(); // Skip if already assigned
  }

  /**
   * Retrieves structural expected fee categories list.
   */
  async listFeeStructures(schoolId: string, tx: DbClient = db) {
    return tx
      .select()
      .from(feeStructures)
      .where(eq(feeStructures.schoolId, schoolId))
      .orderBy(desc(feeStructures.createdAt));
  }

  /**
   * Get total metrics for dashboard (Expected, Collected, Outstanding).
   */
  async getFeeDashboardMetrics(schoolId: string, tx: DbClient = db) {
    const [expectedResult] = await tx
      .select({ total: sum(feeAssignments.amountDue) })
      .from(feeAssignments)
      .where(eq(feeAssignments.schoolId, schoolId));

    const [collectedResult] = await tx
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(and(eq(payments.schoolId, schoolId), eq(payments.status, "success")));

    const expected = parseFloat(String(expectedResult?.total || 0));
    const collected = parseFloat(String(collectedResult?.total || 0));
    const outstanding = Math.max(0, expected - collected);

    return { expected, collected, outstanding };
  }

  /**
   * Retrieves student fee assignments, paid history, and balance details.
   */
  async getStudentFeeDetails(schoolId: string, studentId: string, tx: DbClient = db) {
    const assignments = await tx
      .select({
        id: feeAssignments.id,
        amountDue: feeAssignments.amountDue,
        term: feeAssignments.term,
        label: feeStructures.label,
        dueDate: feeStructures.dueDate,
      })
      .from(feeAssignments)
      .innerJoin(feeStructures, eq(feeAssignments.feeStructureId, feeStructures.id))
      .where(and(eq(feeAssignments.schoolId, schoolId), eq(feeAssignments.studentId, studentId)));

    const paymentHistory = await tx
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        momoNetwork: payments.momoNetwork,
        momoPhone: payments.momoPhone,
        hubtelReference: payments.hubtelReference,
        status: payments.status,
        receiptNumber: payments.receiptNumber,
        paidAt: payments.paidAt,
        feeAssignmentId: payments.feeAssignmentId,
      })
      .from(payments)
      .where(and(eq(payments.schoolId, schoolId), eq(payments.studentId, studentId)))
      .orderBy(desc(payments.createdAt));

    const details = assignments.map((assign) => {
      const successfulPayments = paymentHistory
        .filter((p) => p.feeAssignmentId === assign.id && p.status === "success")
        .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

      const due = parseFloat(String(assign.amountDue));
      const outstanding = Math.max(0, due - successfulPayments);

      return {
        ...assign,
        amountDue: due,
        amountPaid: successfulPayments,
        outstanding,
      };
    });

    const totalDue = details.reduce((sum, d) => sum + d.amountDue, 0);
    const totalPaid = details.reduce((sum, d) => sum + d.amountPaid, 0);
    const totalOutstanding = Math.max(0, totalDue - totalPaid);

    return {
      assignments: details,
      paymentHistory,
      totalDue,
      totalPaid,
      totalOutstanding,
    };
  }

  /**
   * Initiates a payment. Resolves next receipt sequence.
   */
  async initiatePayment(
    schoolId: string,
    input: {
      studentId: string;
      feeAssignmentId: string;
      amount: number;
      paymentMethod: "momo" | "cash" | "bank";
      momoNetwork?: "mtn" | "telecel" | "airteltigo";
      momoPhone?: string;
      hubtelReference?: string;
      status?: "pending" | "success" | "failed";
      recordedBy?: string;
    },
    tx: DbClient = db
  ) {
    const year = new Date().getFullYear();
    const prefix = `SCH-${year}-`;

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(like(payments.receiptNumber, `${prefix}%`));

    const nextNum = (countResult?.count || 0) + 1;
    const receiptNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

    const [result] = await tx
      .insert(payments)
      .values({
        schoolId,
        studentId: input.studentId,
        feeAssignmentId: input.feeAssignmentId,
        amount: String(input.amount),
        paymentMethod: input.paymentMethod,
        momoNetwork: input.momoNetwork || null,
        momoPhone: input.momoPhone || null,
        hubtelReference: input.hubtelReference || null,
        status: input.status || "pending",
        recordedBy: input.recordedBy || null,
        receiptNumber,
        paidAt: input.status === "success" ? new Date() : null,
      })
      .returning();

    return result;
  }

  /**
   * Updates payment status.
   */
  async updatePaymentStatus(
    id: string,
    status: "pending" | "success" | "failed",
    hubtelReference?: string,
    tx: DbClient = db
  ) {
    const updateClause: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "success") {
      updateClause.paidAt = new Date();
    }
    if (hubtelReference) {
      updateClause.hubtelReference = hubtelReference;
    }

    const [result] = await tx
      .update(payments)
      .set(updateClause)
      .where(eq(payments.id, id))
      .returning();
    
    return result;
  }

  /**
   * Retrieves Collections log reports joined with student names and recorders.
   */
  async getCollectionsReport(
    schoolId: string,
    filters: { classId?: string; term?: number; status?: "pending" | "success" | "failed" } = {},
    tx: DbClient = db
  ) {
    const conditions = [eq(payments.schoolId, schoolId)];

    if (filters.status) {
      conditions.push(eq(payments.status, filters.status));
    }
    if (filters.classId) {
      conditions.push(eq(enrolments.classId, filters.classId));
    }
    if (filters.term) {
      conditions.push(eq(feeAssignments.term, filters.term));
    }

    return tx
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        momoNetwork: payments.momoNetwork,
        receiptNumber: payments.receiptNumber,
        status: payments.status,
        paidAt: payments.paidAt,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        studentEmisNumber: students.emisNumber,
        className: classes.name,
        recorderName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(payments)
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(feeAssignments, eq(payments.feeAssignmentId, feeAssignments.id))
      .leftJoin(enrolments, eq(students.id, enrolments.studentId))
      .leftJoin(classes, eq(enrolments.classId, classes.id))
      .leftJoin(users, eq(payments.recordedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt));
  }

  /**
   * Lists overall student arrears lists sorted by amount owed.
   */
  async getOutstandingArrearsList(schoolId: string, tx: DbClient = db) {
    const expected = await tx
      .select({
        studentId: feeAssignments.studentId,
        totalDue: sum(feeAssignments.amountDue),
      })
      .from(feeAssignments)
      .where(eq(feeAssignments.schoolId, schoolId))
      .groupBy(feeAssignments.studentId);

    const collected = await tx
      .select({
        studentId: payments.studentId,
        totalPaid: sum(payments.amount),
      })
      .from(payments)
      .where(and(eq(payments.schoolId, schoolId), eq(payments.status, "success")))
      .groupBy(payments.studentId);

    const rosters = await tx
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        emisNumber: students.emisNumber,
        className: classes.name,
      })
      .from(students)
      .leftJoin(enrolments, eq(students.id, enrolments.studentId))
      .leftJoin(classes, eq(enrolments.classId, classes.id))
      .where(and(eq(students.schoolId, schoolId), eq(enrolments.status, "active")));

    const list = rosters.map((student) => {
      const exp = expected.find((e) => e.studentId === student.id);
      const col = collected.find((c) => c.studentId === student.id);

      const due = parseFloat(String(exp?.totalDue || 0));
      const paid = parseFloat(String(col?.totalPaid || 0));
      const balance = Math.max(0, due - paid);

      return {
        ...student,
        totalDue: due,
        totalPaid: paid,
        balance,
      };
    })
    .filter((s) => s.balance > 0)
    .sort((a, b) => b.balance - a.balance);

    return list;
  }
}
