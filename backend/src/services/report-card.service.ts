import { withSchoolContext } from "../db";
import { ReportCardRepository, UpsertReportCardInput } from "../repositories/report-card.repository";
import { ScoreRepository } from "../repositories/score.repository";
import { SubjectRepository } from "../repositories/subject.repository";
import { ClassRepository } from "../repositories/class.repository";
import { StudentRepository } from "../repositories/student.repository";
import { SchoolRepository } from "../repositories/school.repository";
import { AcademicYearRepository } from "../repositories/academic-year.repository";
import { AttendanceRepository } from "../repositories/attendance.repository";
import { ReportCardPdfService, ReportCardPdfData } from "./pdf.service";
import { NotificationService } from "./notification.service";
import { StorageService } from "./storage.service";

const reportCardRepo = new ReportCardRepository();
const scoreRepo = new ScoreRepository();
const subjectRepo = new SubjectRepository();
const classRepo = new ClassRepository();
const studentRepo = new StudentRepository();
const schoolRepo = new SchoolRepository();
const academicYearRepo = new AcademicYearRepository();
const attendanceRepo = new AttendanceRepository();
const pdfService = new ReportCardPdfService();
const notificationService = new NotificationService();

function getGradePoints(grade: string): number {
  switch (grade.toUpperCase()) {
    case "A1": return 1;
    case "B2": return 2;
    case "B3": return 3;
    case "C4": return 4;
    case "C5": return 5;
    case "C6": return 6;
    case "D7": return 7;
    case "E8": return 8;
    case "F9": return 9;
    default: return 9;
  }
}

export class ReportCardService {
  /**
   * Triggers the background generation of report cards for a class stream.
   * Immediately sets the status of all student report cards to 'generating' and returns.
   */
  async generateReportCards(
    schoolId: string,
    input: {
      classId: string;
      academicYearId: string;
      term: number;
      termStartDate?: string;
      termEndDate?: string;
      nextTermBegins?: string;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const studentsInClass = await studentRepo.list(
        schoolId,
        { classId: input.classId, academicYearId: input.academicYearId },
        tx
      );

      if (studentsInClass.length === 0) {
        throw new Error("No active students found in the selected class stream");
      }

      for (const student of studentsInClass) {
        await reportCardRepo.upsertReportCard(
          schoolId,
          {
            studentId: student.id,
            classId: input.classId,
            academicYearId: input.academicYearId,
            term: input.term,
            nextTermBegins: input.nextTermBegins,
            status: "generating",
          },
          tx
        );
      }

      // Trigger background compilation
      setImmediate(() => {
        this.runBackgroundGeneration(
          schoolId,
          input.classId,
          input.academicYearId,
          input.term,
          input.termStartDate,
          input.termEndDate,
          input.nextTermBegins
        ).catch((err) => {
          console.error("[ReportCardService] Background compilation failure:", err);
        });
      });

      return {
        success: true,
        count: studentsInClass.length,
        message: "Report card generation started in the background.",
      };
    });
  }

  /**
   * Background runner to calculate aggregates, class ranks, and compile PDFs.
   */
  private async runBackgroundGeneration(
    schoolId: string,
    classId: string,
    academicYearId: string,
    term: number,
    termStartDate?: string,
    termEndDate?: string,
    nextTermBegins?: string
  ) {
    const contextData = await withSchoolContext(schoolId, async (tx) => {
      const school = await schoolRepo.findById(schoolId, tx);
      const classRecord = await classRepo.findById(classId, tx);
      const academicYear = await academicYearRepo.findById(academicYearId, tx);
      const studentsInClass = await studentRepo.list(schoolId, { classId, academicYearId }, tx);
      const classScores = await scoreRepo.listClassScores(schoolId, classId, academicYearId, term, tx);

      return { school, classRecord, academicYear, studentsInClass, classScores };
    });

    const { school, classRecord, academicYear, studentsInClass, classScores } = contextData;
    if (!school || !classRecord || !academicYear) {
      console.error("[ReportCardService] Missing core context for generation");
      return;
    }

    const isJHS = classRecord.level >= 7;
    const coreCodes = ["ENG", "MAT", "SCI", "SOC"];

    const studentAggregates: Record<string, number> = {};

    for (const student of studentsInClass) {
      const studentScores = classScores.filter((s) => s.studentId === student.id);
      
      let aggregate = 0;

      if (isJHS) {
        const coreScores = studentScores.filter((s) => coreCodes.includes(s.subjectCode.toUpperCase()));
        const electiveScores = studentScores.filter((s) => !coreCodes.includes(s.subjectCode.toUpperCase()));

        let corePointsSum = 0;
        coreCodes.forEach((code) => {
          const matched = coreScores.find((cs) => cs.subjectCode.toUpperCase() === code);
          corePointsSum += matched ? getGradePoints(matched.grade) : 9;
        });

        const electivePointsSorted = electiveScores
          .map((es) => getGradePoints(es.grade))
          .sort((a, b) => a - b);

        const elective1 = electivePointsSorted[0] !== undefined ? electivePointsSorted[0] : 9;
        const elective2 = electivePointsSorted[1] !== undefined ? electivePointsSorted[1] : 9;

        aggregate = corePointsSum + elective1 + elective2;
      } else {
        const points = studentScores.map((s) => getGradePoints(s.grade));
        aggregate = points.reduce((sum, p) => sum + p, 0);
      }

      studentAggregates[student.id] = aggregate;

      await withSchoolContext(schoolId, async (tx) => {
        await reportCardRepo.upsertReportCard(
          schoolId,
          {
            studentId: student.id,
            classId,
            academicYearId,
            term,
            aggregate,
            status: "generating",
          },
          tx
        );
      });
    }

    const classReportCards = await withSchoolContext(schoolId, async (tx) => {
      return reportCardRepo.listClassReportCards(schoolId, classId, academicYearId, term, tx);
    });

    const sortedReportCards = [...classReportCards].sort((a, b) => {
      const aggA = a.aggregate !== null ? a.aggregate : 999;
      const aggB = b.aggregate !== null ? b.aggregate : 999;
      return aggA - aggB;
    });

    const studentRanks: Record<string, number> = {};
    let currentRank = 1;
    let skip = 0;

    for (let i = 0; i < sortedReportCards.length; i++) {
      const currentAgg = sortedReportCards[i].aggregate;
      if (i > 0 && currentAgg !== sortedReportCards[i - 1].aggregate) {
        currentRank += skip;
        skip = 1;
      } else {
        skip++;
      }
      studentRanks[sortedReportCards[i].studentId] = currentRank;
      
      await withSchoolContext(schoolId, async (tx) => {
        await reportCardRepo.upsertReportCard(
          schoolId,
          {
            studentId: sortedReportCards[i].studentId,
            classId,
            academicYearId,
            term,
            classPosition: currentRank,
            status: "generating",
          },
          tx
        );
      });
    }

    const port = process.env.PORT || 5000;
    const serverUrl = `http://localhost:${port}`;
    let schoolLogoUrl = school.logoUrl || "";
    if (schoolLogoUrl && schoolLogoUrl.startsWith("/")) {
      schoolLogoUrl = `${serverUrl}${schoolLogoUrl}`;
    }
    let headteacherSignatureUrl = (school as any).headteacherSignatureUrl || "";
    if (headteacherSignatureUrl && headteacherSignatureUrl.startsWith("/")) {
      headteacherSignatureUrl = `${serverUrl}${headteacherSignatureUrl}`;
    }
    let schoolStampUrl = (school as any).schoolStampUrl || "";
    if (schoolStampUrl && schoolStampUrl.startsWith("/")) {
      schoolStampUrl = `${serverUrl}${schoolStampUrl}`;
    }

    for (const student of studentsInClass) {
      try {
        const attendanceMetrics = await withSchoolContext(schoolId, async (tx) => {
          const start = termStartDate || "2020-01-01";
          const end = termEndDate || "2030-12-31";
          const logs = await attendanceRepo.getStudentHistory(schoolId, student.id, start, end, tx);
          
          let presenceCount = 0;
          let absenceCount = 0;
          logs.forEach((log) => {
            if (log.status === "present" || log.status === "late" || log.status === "excused") {
              presenceCount++;
            } else if (log.status === "absent") {
              absenceCount++;
            }
          });

          return { presenceCount, absenceCount, totalSessions: logs.length };
        });

        const studentScores = classScores.filter((s) => s.studentId === student.id);
        const pdfSubjects = studentScores.map((s) => ({
          name: s.subjectName,
          code: s.subjectCode,
          classScore: parseFloat(String(s.classScore)),
          examScore: parseFloat(String(s.examScore)),
          total: parseFloat(String(s.total)),
          grade: s.grade,
          remark: "",
        }));

        const studentReportCardRow = await withSchoolContext(schoolId, async (tx) => {
          return reportCardRepo.getReportCard(schoolId, student.id, academicYearId, term, tx);
        });

        const pdfData: ReportCardPdfData = {
          schoolName: school.name,
          schoolAddress: school.address || undefined,
          schoolPhone: school.phone || undefined,
          schoolEmail: school.email || undefined,
          schoolLogoUrl: schoolLogoUrl || undefined,
          headteacherSignatureUrl: headteacherSignatureUrl || undefined,
          schoolStampUrl: schoolStampUrl || undefined,
          studentName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
          emisNumber: student.emisNumber || undefined,
          className: classRecord.name,
          academicYear: academicYear.label,
          term,
          classPosition: studentRanks[student.id] || 1,
          classSize: studentsInClass.length,
          aggregate: studentAggregates[student.id] || 54,
          presenceCount: attendanceMetrics.presenceCount,
          absenceCount: attendanceMetrics.absenceCount,
          totalSessions: attendanceMetrics.totalSessions,
          teacherRemarks: studentReportCardRow?.teacherRemarks || undefined,
          headRemarks: studentReportCardRow?.headRemarks || undefined,
          nextTermBegins: nextTermBegins || undefined,
          promoted: studentReportCardRow?.promoted || undefined,
          subjects: pdfSubjects,
        };

        const uploadedUrl = await pdfService.generateAndUploadReportCard(pdfData);

        await withSchoolContext(schoolId, async (tx) => {
          const row = await reportCardRepo.getReportCard(schoolId, student.id, academicYearId, term, tx);
          if (row) {
            await reportCardRepo.updateStatus(row.id, "completed", uploadedUrl, tx);
          }
        });

      } catch (pdfErr) {
        console.error(`[ReportCardService] Failed to compile report card for student ${student.id}:`, pdfErr);
        
        await withSchoolContext(schoolId, async (tx) => {
          const row = await reportCardRepo.getReportCard(schoolId, student.id, academicYearId, term, tx);
          if (row) {
            await reportCardRepo.updateStatus(row.id, "failed", undefined, tx);
          }
        });
      }
    }

    console.log(`[ReportCardService] Finished background compilation for class ${classId}`);
    
    try {
      await notificationService.sendReportCardAlerts(schoolId, classId);
    } catch (err) {
      console.error("[ReportCardService] Failed to send report card alerts:", err);
    }
  }

  /**
   * Retrieves all report cards for a class in a term.
   */
  async getClassReportCards(schoolId: string, classId: string, academicYearId: string, term: number) {
    return withSchoolContext(schoolId, async (tx) => {
      return reportCardRepo.listClassReportCards(schoolId, classId, academicYearId, term, tx);
    });
  }

  /**
   * Retrieves report card status or details for a student.
   */
  async getStudentReportCard(schoolId: string, studentId: string, academicYearId: string, term: number) {
    return withSchoolContext(schoolId, async (tx) => {
      return reportCardRepo.getReportCard(schoolId, studentId, academicYearId, term, tx);
    });
  }

  /**
   * Directly updates report card comments/remarks prior to generation.
   */
  async updateReportRemarks(
    schoolId: string,
    input: {
      studentId: string;
      academicYearId: string;
      term: number;
      classId: string;
      teacherRemarks?: string;
      headRemarks?: string;
      promoted?: boolean;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const result = await reportCardRepo.upsertReportCard(
        schoolId,
        {
          studentId: input.studentId,
          classId: input.classId,
          academicYearId: input.academicYearId,
          term: input.term,
          teacherRemarks: input.teacherRemarks,
          headRemarks: input.headRemarks,
          promoted: input.promoted,
        },
        tx
      );

      return { success: true, data: result };
    });
  }

  async getSchoolSettings(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const school = await schoolRepo.findById(schoolId, tx);
      if (!school) throw new Error("School not found");
      return {
        logoUrl: school.logoUrl,
        headteacherSignatureUrl: (school as any).headteacherSignatureUrl,
        schoolStampUrl: (school as any).schoolStampUrl,
      };
    });
  }

  async updateSchoolAsset(
    schoolId: string,
    assetType: "logo" | "signature" | "stamp",
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const storageService = new StorageService();
      const uploadedUrl = await storageService.uploadFile(fileBuffer, fileName, mimeType);

      let updatePayload: any = {};
      if (assetType === "logo") {
        updatePayload.logoUrl = uploadedUrl;
      } else if (assetType === "signature") {
        updatePayload.headteacherSignatureUrl = uploadedUrl;
      } else if (assetType === "stamp") {
        updatePayload.schoolStampUrl = uploadedUrl;
      }

      await schoolRepo.update(schoolId, updatePayload, tx);
      return { url: uploadedUrl };
    });
  }
}
