import { withSchoolContext, db } from "../db";
import { FeeRepository } from "../repositories/fee.repository";
import { StudentRepository } from "../repositories/student.repository";
import { SchoolRepository } from "../repositories/school.repository";
import { ClassRepository } from "../repositories/class.repository";
import { AcademicYearRepository } from "../repositories/academic-year.repository";
import { HubtelService } from "./hubtel.service";
import { SmsService } from "./sms.service";
import { NotificationService } from "./notification.service";
import puppeteer from "puppeteer";
import { eq, and } from "drizzle-orm";
import { feeAssignments, feeStructures, payments } from "../db/schema";

const feeRepo = new FeeRepository();
const studentRepo = new StudentRepository();
const schoolRepo = new SchoolRepository();
const classRepo = new ClassRepository();
const academicYearRepo = new AcademicYearRepository();
const hubtelService = new HubtelService();
const smsService = new SmsService();
const notificationService = new NotificationService();

export class FeeService {
  /**
   * Creates a new fee structure configuration.
   */
  async createFeeStructure(
    schoolId: string,
    input: {
      academicYearId: string;
      term: number;
      classLevel: number;
      label: string;
      amount: number;
      dueDate: string;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      return feeRepo.createFeeStructure(
        schoolId,
        {
          schoolId,
          academicYearId: input.academicYearId,
          term: input.term,
          classLevel: input.classLevel,
          label: input.label,
          amount: String(input.amount),
          dueDate: input.dueDate,
        },
        tx
      );
    });
  }

  /**
   * Assigns a fee structure to all students in a class stream.
   */
  async assignFeeToClass(
    schoolId: string,
    input: {
      feeStructureId: string;
      classId: string;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const classRecord = await classRepo.findById(input.classId, tx);
      if (!classRecord) throw new Error("Class not found");

      const structure = await tx
        .select()
        .from(feeStructures)
        .where(and(eq(feeStructures.id, input.feeStructureId), eq(feeStructures.schoolId, schoolId)))
        .limit(1);

      if (structure.length === 0) throw new Error("Fee structure not found");

      const studentRosters = await studentRepo.list(
        schoolId,
        { classId: input.classId, academicYearId: classRecord.academicYearId },
        tx
      );

      if (studentRosters.length === 0) {
        return { success: true, count: 0, message: "No students in the class stream to assign fees." };
      }

      const records = studentRosters.map((student) => ({
        studentId: student.id,
        feeStructureId: input.feeStructureId,
        academicYearId: classRecord.academicYearId,
        term: structure[0].term,
        amountDue: String(structure[0].amount),
      }));

      await feeRepo.bulkAssignFeeToStudents(schoolId, records, tx);

      return {
        success: true,
        count: studentRosters.length,
        message: `Successfully assigned fee "${structure[0].label}" to ${studentRosters.length} students.`,
      };
    });
  }

  /**
   * Retrieves outstanding fees details for a student.
   */
  async getStudentFeeDetails(schoolId: string, studentId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return feeRepo.getStudentFeeDetails(schoolId, studentId, tx);
    });
  }

  /**
   * Records a successful cash payment. Dispatches SMS receipt.
   */
  async payCash(
    schoolId: string,
    recordedBy: string,
    input: {
      studentId: string;
      feeAssignmentId: string;
      amount: number;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const payment = await feeRepo.initiatePayment(
        schoolId,
        {
          studentId: input.studentId,
          feeAssignmentId: input.feeAssignmentId,
          amount: input.amount,
          paymentMethod: "cash",
          status: "success",
          recordedBy,
        },
        tx
      );

      // Trigger SMS receipt in background
      setImmediate(() => {
        this.sendReceiptSms(schoolId, payment.id).catch((err) =>
          console.error("[FeeService] SMS dispatch failure:", err)
        );
        // Fire in-app notification for payment success
        this.firePaymentNotification(schoolId, input.studentId, payment.receiptNumber, input.amount).catch((err) =>
          console.error("[FeeService] Notification dispatch failure:", err)
        );
      });

      return { success: true, payment };
    });
  }

  /**
   * Initiates a Mobile Money payment via Hubtel Receive Money API.
   * Registers a 5-minute delayed poll callback.
   */
  async payMobileMoney(
    schoolId: string,
    input: {
      studentId: string;
      feeAssignmentId: string;
      amount: number;
      phone: string;
      network: "mtn" | "telecel" | "airteltigo";
      hostname: string;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const student = await studentRepo.findById(input.studentId, tx);
      if (!student) throw new Error("Student not found");

      // Initiate pending payment
      const payment = await feeRepo.initiatePayment(
        schoolId,
        {
          studentId: input.studentId,
          feeAssignmentId: input.feeAssignmentId,
          amount: input.amount,
          paymentMethod: "momo",
          momoNetwork: input.network,
          momoPhone: input.phone,
          status: "pending",
        },
        tx
      );

      // Trigger Hubtel Mobile Money receive prompt
      const callbackUrl = `${input.hostname}/api/v1/webhooks/hubtel`;
      
      const hubtelRes = await hubtelService.receiveMobileMoney({
        amount: input.amount,
        phone: input.phone,
        network: input.network,
        clientReference: payment.receiptNumber,
        customerName: `${student.firstName} ${student.lastName}`,
        callbackUrl,
      });

      if (hubtelRes.success) {
        await feeRepo.updatePaymentStatus(payment.id, "pending", hubtelRes.transactionId, tx);
        
        // 5-minute status poll fallback configuration
        setTimeout(() => {
          this.reconcilePaymentStatus(schoolId, payment.id).catch((err) =>
            console.error("[FeeService] Delayed polling check failure:", err)
          );
        }, 5 * 60 * 1000);

        return {
          success: true,
          checkoutUrl: hubtelRes.checkoutUrl,
          message: "Mobile money prompt initiated. Verify payment status on parent's phone.",
          paymentId: payment.id,
        };
      } else {
        await feeRepo.updatePaymentStatus(payment.id, "failed", undefined, tx);
        throw new Error("Mobile money transaction initiation failed");
      }
    });
  }

  /**
   * Resolves transaction state via Hubtel Status API when webhook callbacks fail.
   */
  async reconcilePaymentStatus(schoolId: string, paymentId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.id, paymentId), eq(payments.schoolId, schoolId)))
        .limit(1);

      const payment = paymentRows[0];
      if (!payment || payment.status !== "pending") return;

      const statusRes = await hubtelService.getTransactionStatus(payment.receiptNumber);

      if (statusRes.status === "success") {
        await feeRepo.updatePaymentStatus(payment.id, "success", statusRes.transactionId || undefined, tx);
        
        setImmediate(() => {
          this.sendReceiptSms(schoolId, payment.id).catch((err) =>
            console.error("[FeeService] SMS dispatch failure:", err)
          );
          this.firePaymentNotification(schoolId, payment.studentId, payment.receiptNumber, parseFloat(String(payment.amount))).catch((err) =>
            console.error("[FeeService] Notification dispatch failure:", err)
          );
        });
      } else if (statusRes.status === "failed") {
        await feeRepo.updatePaymentStatus(payment.id, "failed", undefined, tx);
      }
    });
  }

  /**
   * Webhook callback updates.
   */
  async handleHubtelWebhook(clientReference: string, hubtelReference: string, status: "success" | "failed") {
    // Lookup payment by clientReference (receiptNumber)
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.receiptNumber, clientReference))
      .limit(1);

    const payment = result[0];
    if (!payment || payment.status !== "pending") return;

    await withSchoolContext(payment.schoolId, async (tx) => {
      await feeRepo.updatePaymentStatus(payment.id, status, hubtelReference, tx);

      if (status === "success") {
        setImmediate(() => {
          this.sendReceiptSms(payment.schoolId, payment.id).catch((err) =>
            console.error("[FeeService] SMS dispatch failure:", err)
          );
          this.firePaymentNotification(payment.schoolId, payment.studentId, payment.receiptNumber, parseFloat(String(payment.amount))).catch((err) =>
            console.error("[FeeService] Notification dispatch failure:", err)
          );
        });
      }
    });
  }

  /**
   * Constructs and dispatches the Africa's Talking parent SMS notification.
   */
  private async sendReceiptSms(schoolId: string, paymentId: string) {
    await withSchoolContext(schoolId, async (tx) => {
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);

      const payment = paymentRows[0];
      if (!payment || payment.status !== "success") return;

      const school = await schoolRepo.findById(schoolId, tx);
      const student = await studentRepo.findById(payment.studentId, tx);
      
      const assignmentRows = await tx
        .select({ term: feeAssignments.term })
        .from(feeAssignments)
        .where(eq(feeAssignments.id, payment.feeAssignmentId))
        .limit(1);

      if (!school || !student) return;

      const guardianPhone = student.guardianPhone;
      const termLabel = assignmentRows[0] ? `Term ${assignmentRows[0].term}` : "";
      
      const message = `${school.name} Payment Receipt\nStudent: ${student.firstName} ${student.lastName}\nAmount: GHS ${payment.amount}\nRef: ${payment.receiptNumber}\n${termLabel} ${new Date().getFullYear()}. Thank you!`;

      await smsService.sendSms(guardianPhone, message);
    });
  }

  /**
   * Compiles receipt PDF records using Puppeteer.
   */
  async generateReceiptPdf(schoolId: string, paymentId: string): Promise<Buffer> {
    const data = await withSchoolContext(schoolId, async (tx) => {
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.id, paymentId), eq(payments.schoolId, schoolId)))
        .limit(1);

      const payment = paymentRows[0];
      if (!payment) throw new Error("Payment record not found");

      const school = await schoolRepo.findById(schoolId, tx);
      const student = await studentRepo.findById(payment.studentId, tx);
      
      const assignmentRows = await tx
        .select({
          amountDue: feeAssignments.amountDue,
          term: feeAssignments.term,
          label: feeStructures.label,
        })
        .from(feeAssignments)
        .innerJoin(feeStructures, eq(feeAssignments.feeStructureId, feeStructures.id))
        .where(eq(feeAssignments.id, payment.feeAssignmentId))
        .limit(1);

      const assignment = assignmentRows[0];
      if (!school || !student || !assignment) throw new Error("Missing context details for receipt compilation");

      // Get student's overall balance info for outstanding total print
      const balanceDetails = await feeRepo.getStudentFeeDetails(schoolId, student.id, tx);

      return { school, student, payment, assignment, balanceDetails };
    });

    const { school, student, payment, assignment, balanceDetails } = data;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${payment.receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Outfit', sans-serif;
      color: #1e293b;
      line-height: 1.4;
      padding: 30px;
      font-size: 12px;
      background-color: #fff;
    }
    
    .receipt-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .school-name {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    
    .school-details {
      font-size: 10px;
      color: #64748b;
      margin-top: 3px;
    }
    
    .receipt-title-badge {
      background-color: #0f172a;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    
    .invoice-details {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }
    
    .detail-card h4 {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    
    .detail-card p {
      font-size: 11px;
      margin-bottom: 3px;
    }
    
    .detail-value {
      font-weight: 600;
      color: #0f172a;
    }
    
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    
    .payment-table th, .payment-table td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
    }
    
    .payment-table th {
      background-color: #f8fafc;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      color: #475569;
    }
    
    .right-align {
      text-align: right;
    }
    
    .balance-summary {
      float: right;
      width: 250px;
      margin-bottom: 30px;
    }
    
    .balance-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 11px;
    }
    
    .balance-row.total {
      border-top: 2px solid #0f172a;
      font-weight: 800;
      font-size: 13px;
      color: #0f172a;
      padding-top: 8px;
    }
    
    .clear {
      clear: both;
    }
    
    .footer {
      border-top: 1px dashed #cbd5e1;
      padding-top: 20px;
      margin-top: 20px;
      text-align: center;
      color: #64748b;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div>
        <h1 class="school-name">${school.name}</h1>
        <p class="school-details">
          ${school.address ? `<span>${school.address}</span>` : ""}
          ${school.phone ? ` | <span>Tel: ${school.phone}</span>` : ""}
        </p>
      </div>
      <div class="receipt-title-badge">Receipt</div>
    </div>
    
    <div class="invoice-details">
      <div class="detail-card">
        <h4>Receipt To:</h4>
        <p><span class="detail-value">${student.firstName} ${student.lastName}</span></p>
        <p>EMIS Number: <span class="detail-value">${student.emisNumber || "N/A"}</span></p>
        <p>Relationship: ${student.guardianRelationship} (${student.guardianName})</p>
      </div>
      <div class="detail-card" style="text-align: right;">
        <h4>Payment Reference:</h4>
        <p>Receipt No: <span class="detail-value">${payment.receiptNumber}</span></p>
        <p>Payment Date: <span class="detail-value">${payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}</span></p>
        <p>Method: <span class="detail-value" style="text-transform: uppercase;">${payment.paymentMethod}</span></p>
        ${payment.hubtelReference ? `<p>Reference: <span class="detail-value font-mono">${payment.hubtelReference}</span></p>` : ""}
      </div>
    </div>
    
    <table class="payment-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="right-align" style="width: 30%;">Amount Paid</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${assignment.label}</strong>
            <p style="font-size: 9px; color: #64748b; margin-top: 2px;">Term: ${assignment.term} | Overall expected fee</p>
          </td>
          <td class="right-align font-semibold">GHS ${parseFloat(String(payment.amount)).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="balance-summary">
      <div class="balance-row">
        <span>Subtotal Paid:</span>
        <span>GHS ${parseFloat(String(payment.amount)).toFixed(2)}</span>
      </div>
      <div class="balance-row">
        <span>Assignment Balance Due:</span>
        <span>GHS ${parseFloat(String(balanceDetails.totalOutstanding)).toFixed(2)}</span>
      </div>
      <div class="balance-row total">
        <span>Total Paid:</span>
        <span>GHS ${parseFloat(String(payment.amount)).toFixed(2)}</span>
      </div>
    </div>
    
    <div class="clear"></div>
    
    <div class="footer">
      <p>Thank you for your prompt payment.</p>
      <p style="font-size: 8px; margin-top: 4px; color: #94a3b8;">This receipt is generated electronically. No physical stamp required.</p>
    </div>
  </div>
</body>
</html>
    `;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" as any });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });
    await browser.close();
    
    return Buffer.from(pdfBuffer);
  }

  /**
   * Report dashboard statistics.
   */
  async getDashboardMetrics(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return feeRepo.getFeeDashboardMetrics(schoolId, tx);
    });
  }

  /**
   * Arrears logs.
   */
  async getArrearsList(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return feeRepo.getOutstandingArrearsList(schoolId, tx);
    });
  }

  /**
   * Collections grid reports.
   */
  async getCollectionsReport(schoolId: string, filters: any) {
    return withSchoolContext(schoolId, async (tx) => {
      return feeRepo.getCollectionsReport(schoolId, filters, tx);
    });
  }

  /**
   * List structural expected fees.
   */
  async listFeeStructures(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return feeRepo.listFeeStructures(schoolId, tx);
    });
  }

  /**
   * Lists all academic years for selection.
   */
  async listAcademicYears(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return academicYearRepo.listAll(schoolId, tx);
    });
  }

  /**
   * Creates an in-app notification after a successful payment.
   * Looks up the student and notifies via the NotificationService.
   */
  private async firePaymentNotification(schoolId: string, studentId: string, receiptNumber: string, amount: number) {
    try {
      const student = await withSchoolContext(schoolId, async (tx) => {
        return studentRepo.findById(studentId, tx);
      });

      if (!student) return;

      const title = "Payment Received";
      const body = `Payment of GHS ${amount.toFixed(2)} for ${student.firstName} ${student.lastName} has been received. Receipt: ${receiptNumber}`;

      // Dispatch SMS to guardian phone
      await notificationService.dispatchSms(schoolId, student.guardianPhone, body);

    } catch (err) {
      console.error("[FeeService] firePaymentNotification error:", err);
    }
  }
}

