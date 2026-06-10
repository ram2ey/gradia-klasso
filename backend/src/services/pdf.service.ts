import * as puppeteer from "puppeteer";
import { StorageService } from "./storage.service";

const storageService = new StorageService();

export interface ReportCardPdfData {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolLogoUrl?: string;
  headteacherSignatureUrl?: string;
  schoolStampUrl?: string;
  studentName: string;
  emisNumber?: string;
  className: string;
  academicYear: string;
  term: number;
  classPosition: number;
  classSize: number;
  aggregate: number;
  presenceCount: number;
  absenceCount: number;
  totalSessions: number;
  teacherRemarks?: string;
  headRemarks?: string;
  nextTermBegins?: string;
  promoted?: boolean;
  subjects: {
    name: string;
    code: string;
    classScore: number;
    examScore: number;
    total: number;
    grade: string;
    remark: string;
  }[];
}

export class ReportCardPdfService {
  /**
   * Generates a PDF buffer from report card details using Puppeteer and uploads it to storage.
   * Returns the accessible URL.
   */
  async generateAndUploadReportCard(data: ReportCardPdfData): Promise<string> {
    const remarkMapping = (grade: string) => {
      switch (grade.toUpperCase()) {
        case "A1": return "Excellent";
        case "B2": return "Very Good";
        case "B3": return "Good";
        case "C4": return "Credit";
        case "C5": return "Credit";
        case "C6": return "Pass";
        case "D7": return "Pass";
        case "E8": return "Pass";
        case "F9": return "Fail";
        default: return "Pass";
      }
    };

    const formattedSubjects = data.subjects.map(s => ({
      ...s,
      remark: remarkMapping(s.grade)
    }));

    const nextBeginsFormatted = data.nextTermBegins 
      ? new Date(data.nextTermBegins).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "To Be Communicated";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Terminal Report Card - ${data.studentName}</title>
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
      padding: 15px;
      font-size: 12px;
      background-color: #fff;
    }
    
    .report-card-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #0f172a;
      padding: 25px;
      position: relative;
    }
    
    .color-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 6px;
      background: linear-gradient(to right, #ce1126 33.3%, #fcd116 33.3%, #fcd116 66.6%, #006b3f 66.6%);
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .school-info {
      flex: 1;
      padding-right: 20px;
    }
    
    .school-name {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    
    .school-details {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      font-weight: 500;
    }
    
    .logo-container img {
      max-width: 80px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .report-title-container {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .report-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    
    .term-badge {
      background-color: #0f172a;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 9999px;
    }
    
    .meta-grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .meta-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 11px;
    }
    
    .meta-row:last-child {
      margin-bottom: 0;
    }
    
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    
    .meta-value {
      font-weight: 600;
      color: #0f172a;
    }
    
    .scores-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .scores-table th, .scores-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    
    .scores-table th {
      background-color: #f1f5f9;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
    }
    
    .scores-table td {
      font-size: 11px;
    }
    
    .text-center {
      text-align: center !important;
    }
    
    .font-semibold {
      font-weight: 600;
    }
    
    .summary-section {
      display: grid;
      grid-template-cols: 1.2fr 0.8fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .remarks-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background-color: #fff;
    }
    
    .remarks-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 4px;
    }
    
    .remarks-content {
      font-size: 11px;
      color: #0f172a;
      min-height: 25px;
      font-style: italic;
    }
    
    .stats-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background-color: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px dashed #cbd5e1;
    }
    
    .stat-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    
    .stat-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #475569;
    }
    
    .stat-value {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    
    .footer-dates {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    
    .signatures-container {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 40px;
      margin-top: 30px;
    }
    
    .sig-block {
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 8px;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
    }
    
    .sig-line {
      height: 30px;
    }
  </style>
</head>
<body>
  <div class="report-card-container">
    <div class="color-bar"></div>
    
    <div class="header">
      <div class="school-info">
        <h1 class="school-name">${data.schoolName}</h1>
        <div class="school-details">
          ${data.schoolAddress ? `<span>${data.schoolAddress}</span>` : ""}
          ${data.schoolPhone ? ` | <span>Tel: ${data.schoolPhone}</span>` : ""}
          ${data.schoolEmail ? ` | <span>Email: ${data.schoolEmail}</span>` : ""}
        </div>
      </div>
      ${data.schoolLogoUrl ? `
      <div class="logo-container">
        <img src="${data.schoolLogoUrl}" alt="School Logo">
      </div>
      ` : ""}
    </div>
    
    <div class="report-title-container">
      <span class="report-title">Terminal Progress Report</span>
      <span class="term-badge">Term ${data.term}</span>
    </div>
    
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-row">
          <span class="meta-label">Student Name:</span>
          <span class="meta-value">${data.studentName}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Student ID / EMIS:</span>
          <span class="meta-value">${data.emisNumber || "N/A"}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Class Stream:</span>
          <span class="meta-value">${data.className}</span>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-row">
          <span class="meta-label">Academic Year:</span>
          <span class="meta-value">${data.academicYear}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Attendance Score:</span>
          <span class="meta-value">${data.presenceCount} / ${data.totalSessions} Sessions</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Promotion Status:</span>
          <span class="meta-value">${data.promoted === true ? "PROMOTED" : data.promoted === false ? "RETAINED" : "N/A"}</span>
        </div>
      </div>
    </div>
    
    <table class="scores-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th class="text-center" style="width: 15%;">Class Score (30)</th>
          <th class="text-center" style="width: 15%;">Exam Score (70)</th>
          <th class="text-center" style="width: 15%;">Total (100)</th>
          <th class="text-center" style="width: 10%;">Grade</th>
          <th style="width: 25%;">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${formattedSubjects.map(s => `
          <tr>
            <td class="font-semibold">${s.name}</td>
            <td class="text-center">${s.classScore}</td>
            <td class="text-center">${s.examScore}</td>
            <td class="text-center font-semibold">${s.total}</td>
            <td class="text-center"><span class="grade-badge">${s.grade}</span></td>
            <td>${s.remark}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    
    <div class="summary-section">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="remarks-card">
          <h4 class="remarks-title">Class Teacher's Remarks</h4>
          <p class="remarks-content">"${data.teacherRemarks || "A satisfactory term's performance. Keep studying hard."}"</p>
        </div>
        <div class="remarks-card">
          <h4 class="remarks-title">Headteacher's Remarks</h4>
          <p class="remarks-content">"${data.headRemarks || "Approved. Promoted accordingly."}"</p>
        </div>
      </div>
      
      <div class="stats-card">
        <div class="stat-row">
          <span class="stat-label">Term Aggregate:</span>
          <span class="stat-value">${data.aggregate}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Class Position:</span>
          <span class="stat-value">${data.classPosition} / ${data.classSize}</span>
        </div>
        <div style="font-size: 8px; color: #64748b; text-align: center; margin-top: 6px; line-height: 1.2;">
          * JHS terminal aggregate is best 6 subjects. Primary is sum of all.
        </div>
      </div>
    </div>
    
    <div class="footer-dates">
      <div>
        <span style="color: #64748b; font-weight: 500;">Next Term Begins:</span>
        <span style="font-weight: 700; color: #0f172a; margin-left: 5px;">${nextBeginsFormatted}</span>
      </div>
      <div>
        <span style="color: #64748b; font-weight: 500;">Date Generated:</span>
        <span style="font-weight: 600; color: #0f172a; margin-left: 5px;">${new Date().toLocaleDateString("en-GB")}</span>
      </div>
    </div>
    
    <div class="signatures-container">
      <div class="sig-block">
        <div class="sig-line"></div>
        Class Teacher's Signature
      </div>
      <div class="sig-block" style="position: relative;">
        ${data.headteacherSignatureUrl ? `
          <img src="${data.headteacherSignatureUrl}" style="position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); max-height: 50px; max-width: 120px; object-fit: contain; z-index: 1;" alt="Headteacher Signature">
        ` : ""}
        ${data.schoolStampUrl ? `
          <img src="${data.schoolStampUrl}" style="position: absolute; bottom: 0px; left: 60%; max-height: 70px; max-width: 70px; object-fit: contain; opacity: 0.85; z-index: 2; transform: rotate(-5deg);" alt="School Stamp">
        ` : ""}
        <div class="sig-line"></div>
        Headteacher's Signature
      </div>
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
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "8mm",
        right: "8mm"
      }
    });
    await browser.close();

    // Upload to Azure Storage or local static folder
    const fileName = `report_card_${data.studentName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_term${data.term}.pdf`;
    return storageService.uploadFile(Buffer.from(pdfBuffer), fileName, "application/pdf");
  }
}
