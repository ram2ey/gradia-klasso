import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import JSZip from "jszip";
import {
  BookOpen,
  Save,
  FileText,
  Download,
  Loader2,
  Play,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit3,
  X,
  Wifi,
  WifiOff,
  Upload
} from "lucide-react";
import { saveScoreDraft, getScoreDraft, removeScoreDraft } from "../utils/offlineDb";

interface ClassItem {
  id: string;
  name: string;
  level: number;
  academicYearId: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  classLevels: number[];
}

interface StudentRosterItem {
  id: string;
  emisNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
}

interface AssessmentScoreRow {
  id: string;
  studentId: string;
  subjectId: string;
  classScore: string;
  examScore: string;
  total: number;
  grade: string;
}

interface ReportCardStatusRow {
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  classPosition: number | null;
  aggregate: number | null;
  promoted: boolean | null;
  teacherRemarks: string | null;
  headRemarks: string | null;
  pdfUrl: string | null;
  status: "pending" | "generating" | "completed" | "failed";
}

export const Gradebook: React.FC = () => {
  const { user } = useAuth();
  
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  
  const [term, setTerm] = useState<number>(3);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [scores, setScores] = useState<Record<string, { classScore: string; examScore: string }>>({});
  const [reportCards, setReportCards] = useState<ReportCardStatusRow[]>([]);
  
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [pollingReports, setPollingReports] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasDraft, setHasDraft] = useState(false);
  
  // Modal states
  const [activeRemarksStudent, setActiveRemarksStudent] = useState<ReportCardStatusRow | null>(null);
  const [remarksTeacher, setRemarksTeacher] = useState("");
  const [remarksHead, setRemarksHead] = useState("");
  const [remarksPromoted, setRemarksPromoted] = useState<boolean | null>(null);
  const [savingRemarks, setSavingRemarks] = useState(false);

  const [activePreviewStudent, setActivePreviewStudent] = useState<StudentRosterItem | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [schoolSettings, setSchoolSettings] = useState<{
    logoUrl?: string;
    headteacherSignatureUrl?: string;
    schoolStampUrl?: string;
  } | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Term parameters for generation
  const [termStartDate, setTermStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [termEndDate, setTermEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextTermBegins, setNextTermBegins] = useState("");

  const isHeadteacher = user?.role === "headteacher";

  const getSelectedClass = () => classes.find((c) => c.id === selectedClassId);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load school settings (logo, stamp, signature) on mount if online
  useEffect(() => {
    const fetchSettings = async () => {
      setLoadingSettings(true);
      const res = await apiRequest("/report-cards/school/settings");
      setLoadingSettings(false);
      if (res.success && res.data) {
        setSchoolSettings(res.data);
      }
    };
    if (isOnline) {
      fetchSettings();
    }
  }, [isOnline]);

  const handleAssetUpload = async (type: "logo" | "signature" | "stamp", file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Max size is 5MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoadingSettings(true);
    setError(null);
    setSuccess(null);

    const res = await apiRequest(`/report-cards/school/upload?type=${type}`, {
      method: "POST",
      body: formData,
    });

    setLoadingSettings(false);

    if (res.success && res.data) {
      setSchoolSettings((prev: any) => ({
        ...prev,
        [type === "logo" ? "logoUrl" : type === "signature" ? "headteacherSignatureUrl" : "schoolStampUrl"]: res.data.url,
      }));
      setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
    } else {
      setError(res.error || `Failed to upload ${type}.`);
    }
  };

  // 1. Fetch Class List
  useEffect(() => {
    const fetchClasses = async () => {
      const res = await apiRequest<ClassItem[]>("/classes");
      if (res.success && res.data) {
        setClasses(res.data);
        if (res.data.length > 0) {
          setSelectedClassId(res.data[0].id);
        }
      }
    };
    fetchClasses();
  }, []);

  // 2. Fetch Subjects when selectedClassId changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!selectedClassId) return;
      const res = await apiRequest<SubjectItem[]>(`/subjects?classId=${selectedClassId}`);
      if (res.success && res.data) {
        setSubjects(res.data);
        if (res.data.length > 0) {
          setSelectedSubjectId(res.data[0].id);
        } else {
          setSelectedSubjectId("");
        }
      }
    };
    fetchSubjects();
  }, [selectedClassId]);

  // 3. Load Roster, Scores, and Report Card logs
  const loadGradebookData = async () => {
    if (!selectedClassId) return;
    const selectedClass = getSelectedClass();
    if (!selectedClass) return;

    setLoadingRoster(true);
    setError(null);
    setSuccess(null);

    // Fetch roster
    const rosterRes = await apiRequest<StudentRosterItem[]>(`/students?classId=${selectedClassId}`);
    if (!rosterRes.success || !rosterRes.data) {
      setError(rosterRes.error || "Failed to load class roster.");
      setLoadingRoster(false);
      return;
    }
    setStudents(rosterRes.data);

    // Fetch existing scores/drafts for selected subject/term
    if (selectedSubjectId) {
      const scoreMap: Record<string, { classScore: string; examScore: string }> = {};
      rosterRes.data.forEach((std) => {
        scoreMap[std.id] = { classScore: "", examScore: "" };
      });

      // Check if there is a local offline draft
      const draft = await getScoreDraft(selectedClassId, selectedSubjectId, term);
      if (draft) {
        setHasDraft(true);
        Object.keys(draft.scores).forEach((stdId) => {
          scoreMap[stdId] = draft.scores[stdId];
        });
        setSuccess("Loaded offline draft. Sync/Save scores to persist on the server.");
      } else {
        setHasDraft(false);
        if (isOnline) {
          const scoresRes = await apiRequest<AssessmentScoreRow[]>(
            `/scores/class/${selectedClassId}?academicYearId=${selectedClass.academicYearId}&term=${term}`
          );
          if (scoresRes.success && scoresRes.data) {
            const activeScores = scoresRes.data.filter((s) => s.subjectId === selectedSubjectId);
            activeScores.forEach((s) => {
              scoreMap[s.studentId] = {
                classScore: s.classScore !== null ? String(parseFloat(String(s.classScore))) : "",
                examScore: s.examScore !== null ? String(parseFloat(String(s.examScore))) : "",
              };
            });
          }
        } else {
          setError("Working offline: Loaded empty entry sheet. Draft saves will cache locally.");
        }
      }
      setScores(scoreMap);
    }

    // Fetch report cards status
    if (isOnline) {
      const reportsRes = await apiRequest<ReportCardStatusRow[]>(
        `/report-cards/class/${selectedClassId}?academicYearId=${selectedClass.academicYearId}&term=${term}`
      );
      if (reportsRes.success && reportsRes.data) {
        setReportCards(reportsRes.data);
      } else {
        setReportCards([]);
      }
    } else {
      setReportCards([]);
    }

    setLoadingRoster(false);
  };

  useEffect(() => {
    loadGradebookData();
  }, [selectedClassId, selectedSubjectId, term, isOnline]);

  // 4. Poll Report Card statuses if any are generating
  useEffect(() => {
    if (reportCards.length === 0) return;
    const isGenerating = reportCards.some((r) => r.status === "generating");
    
    if (!isGenerating) {
      setPollingReports(false);
      return;
    }

    setPollingReports(true);

    const interval = setInterval(async () => {
      const selectedClass = getSelectedClass();
      if (!selectedClass) return;

      const reportsRes = await apiRequest<ReportCardStatusRow[]>(
        `/report-cards/class/${selectedClassId}?academicYearId=${selectedClass.academicYearId}&term=${term}`
      );
      if (reportsRes.success && reportsRes.data) {
        setReportCards(reportsRes.data);
        const stillGenerating = reportsRes.data.some((r) => r.status === "generating");
        if (!stillGenerating) {
          setPollingReports(false);
          setSuccess("All class report cards processed successfully!");
          clearInterval(interval);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [reportCards, selectedClassId, term]);

  // 5. Handle Score Changes
  const handleScoreChange = (studentId: string, type: "classScore" | "examScore", val: string) => {
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [type]: val,
      },
    }));
  };

  // 6. Live Calculations
  const getLiveStats = (studentId: string) => {
    const s = scores[studentId] || { classScore: "", examScore: "" };
    const classScoreNum = parseFloat(s.classScore);
    const examScoreNum = parseFloat(s.examScore);

    if (isNaN(classScoreNum) || isNaN(examScoreNum)) {
      return { total: "--", grade: "--", color: "text-slate-400 border-slate-800" };
    }

    const total = parseFloat(((classScoreNum * 0.3) + (examScoreNum * 0.7)).toFixed(2));
    let grade = "--";
    let color = "bg-slate-800/80 border-slate-700 text-slate-300";

    if (total >= 80) { grade = "A1"; color = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"; }
    else if (total >= 70) { grade = "B2"; color = "bg-teal-500/10 border-teal-500/20 text-teal-400"; }
    else if (total >= 60) { grade = "B3"; color = "bg-sky-500/10 border-sky-500/20 text-sky-400"; }
    else if (total >= 55) { grade = "C4"; color = "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"; }
    else if (total >= 50) { grade = "C5"; color = "bg-purple-500/10 border-purple-500/20 text-purple-400"; }
    else if (total >= 45) { grade = "C6"; color = "bg-amber-500/10 border-amber-500/20 text-amber-400"; }
    else if (total >= 40) { grade = "D7"; color = "bg-orange-500/10 border-orange-500/20 text-orange-400"; }
    else if (total >= 35) { grade = "E8"; color = "bg-rose-500/10 border-rose-500/20 text-rose-400"; }
    else { grade = "F9"; color = "bg-red-500/10 border-red-500/20 text-red-400 font-bold"; }

    return { total, grade, color };
  };

  // 7. Save Continuous Scores
  const saveSubjectScores = async () => {
    if (!selectedClassId || !selectedSubjectId) return;
    const selectedClass = getSelectedClass();
    if (!selectedClass) return;

    setSavingScores(true);
    setError(null);
    setSuccess(null);

    const recordsPayload = students
      .map((std) => {
        const stdScore = scores[std.id] || { classScore: "", examScore: "" };
        const classScoreNum = parseFloat(stdScore.classScore);
        const examScoreNum = parseFloat(stdScore.examScore);

        if (isNaN(classScoreNum) || isNaN(examScoreNum)) {
          return null;
        }

        return {
          studentId: std.id,
          classScore: classScoreNum,
          examScore: examScoreNum,
        };
      })
      .filter((r) => r !== null);

    if (recordsPayload.length === 0) {
      setError("Please input scores for at least one student before saving.");
      setSavingScores(false);
      return;
    }

    if (!isOnline) {
      try {
        await saveScoreDraft(selectedClassId, selectedSubjectId, term, scores);
        setSuccess("Saved as local offline draft! You will be prompted to sync when internet returns.");
        setHasDraft(true);
      } catch (err: any) {
        setError("Failed to save offline draft: " + err.message);
      }
      setSavingScores(false);
      return;
    }

    const res = await apiRequest("/scores/bulk", {
      method: "POST",
      body: {
        classId: selectedClassId,
        academicYearId: selectedClass.academicYearId,
        term,
        subjectId: selectedSubjectId,
        records: recordsPayload,
      },
    });

    if (res.success) {
      setSuccess("Scores recorded and grading trigger calculated successfully!");
      await removeScoreDraft(selectedClassId, selectedSubjectId, term);
      setHasDraft(false);
      loadGradebookData();
    } else {
      setError(res.error || "Failed to save continuous assessment marks.");
    }
    setSavingScores(false);
  };

  const syncOfflineDraft = async () => {
    if (!selectedClassId || !selectedSubjectId) return;
    const selectedClass = getSelectedClass();
    if (!selectedClass) return;

    setSavingScores(true);
    setError(null);
    setSuccess(null);

    const recordsPayload = students
      .map((std) => {
        const stdScore = scores[std.id] || { classScore: "", examScore: "" };
        const classScoreNum = parseFloat(stdScore.classScore);
        const examScoreNum = parseFloat(stdScore.examScore);

        if (isNaN(classScoreNum) || isNaN(examScoreNum)) {
          return null;
        }

        return {
          studentId: std.id,
          classScore: classScoreNum,
          examScore: examScoreNum,
        };
      })
      .filter((r) => r !== null);

    if (recordsPayload.length === 0) {
      setError("No valid scores to sync.");
      setSavingScores(false);
      return;
    }

    const res = await apiRequest("/scores/bulk", {
      method: "POST",
      body: {
        classId: selectedClassId,
        academicYearId: selectedClass.academicYearId,
        term,
        subjectId: selectedSubjectId,
        records: recordsPayload,
      },
    });

    if (res.success) {
      setSuccess("Scores from offline draft successfully synchronized with the server!");
      await removeScoreDraft(selectedClassId, selectedSubjectId, term);
      setHasDraft(false);
      loadGradebookData();
    } else {
      setError(res.error || "Failed to sync offline draft scores.");
    }
    setSavingScores(false);
  };

  const discardOfflineDraft = async () => {
    if (!selectedClassId || !selectedSubjectId) return;
    await removeScoreDraft(selectedClassId, selectedSubjectId, term);
    setHasDraft(false);
    setSuccess("Offline scores draft discarded.");
    loadGradebookData();
  };

  // 8. Bulk Generate Reports
  const triggerReportsGeneration = async () => {
    if (!selectedClassId) return;
    const selectedClass = getSelectedClass();
    if (!selectedClass) return;

    setGeneratingReports(true);
    setError(null);
    setSuccess(null);

    const res = await apiRequest("/report-cards/generate", {
      method: "POST",
      body: {
        classId: selectedClassId,
        academicYearId: selectedClass.academicYearId,
        term,
        termStartDate,
        termEndDate,
        nextTermBegins: nextTermBegins || undefined,
      },
    });

    if (res.success) {
      setSuccess("Background PDF compilation started. Polling progress logs...");
      // Update local state with generating indicators
      setReportCards((prev) =>
        prev.map((r) => ({ ...r, status: "generating" as const }))
      );
    } else {
      setError(res.error || "Failed to trigger report cards generation.");
    }
    setGeneratingReports(false);
  };

  // 9. Fetch and Download ZIP
  const downloadAllPdfsZip = async () => {
    const completedReports = reportCards.filter((r) => r.status === "completed" && r.pdfUrl);
    if (completedReports.length === 0) {
      setError("No completed report cards found to download.");
      return;
    }

    setSuccess("Downloading and packaging PDF buffers... Please wait.");
    const zip = new JSZip();

    try {
      for (const rep of completedReports) {
        if (!rep.pdfUrl) continue;
        const response = await fetch(rep.pdfUrl);
        const blob = await response.blob();
        const cleanName = `${rep.studentFirstName}_${rep.studentLastName}_Term${term}.pdf`.replace(/[^a-zA-Z0-9_.]/g, "");
        zip.file(cleanName, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `ReportCards_${getSelectedClass()?.name}_Term${term}.zip`;
      link.click();
      setSuccess("ZIP archive downloaded successfully!");
    } catch (zipErr: any) {
      console.error(zipErr);
      setError("Failed to bundle report card archive.");
    }
  };

  // 10. Edit Remarks Modal helper
  const openRemarksModal = (studentCard: ReportCardStatusRow) => {
    setActiveRemarksStudent(studentCard);
    setRemarksTeacher(studentCard.teacherRemarks || "");
    setRemarksHead(studentCard.headRemarks || "");
    setRemarksPromoted(studentCard.promoted);
  };

  const saveRemarks = async () => {
    if (!activeRemarksStudent) return;
    setSavingRemarks(true);

    const res = await apiRequest("/report-cards/remarks", {
      method: "PUT",
      body: {
        studentId: activeRemarksStudent.studentId,
        classId: selectedClassId,
        academicYearId: getSelectedClass()?.academicYearId,
        term,
        teacherRemarks: remarksTeacher,
        headRemarks: remarksHead,
        promoted: remarksPromoted !== null ? remarksPromoted : undefined,
      },
    });

    if (res.success) {
      setReportCards((prev) =>
        prev.map((r) =>
          r.studentId === activeRemarksStudent.studentId
            ? {
                ...r,
                teacherRemarks: remarksTeacher,
                headRemarks: remarksHead,
                promoted: remarksPromoted,
              }
            : r
        )
      );
      setActiveRemarksStudent(null);
    } else {
      setError(res.error || "Failed to update remarks comments.");
    }

    setSavingRemarks(false);
  };

  // 11. Individual Report Card Preview
  const openStudentPreview = async (student: StudentRosterItem) => {
    setActivePreviewStudent(student);
    setLoadingPreview(true);
    setPreviewData(null);

    const selectedClass = getSelectedClass();
    if (!selectedClass) return;

    // Load student scores
    const scoresRes = await apiRequest<AssessmentScoreRow[]>(
      `/scores/student/${student.id}?academicYearId=${selectedClass.academicYearId}&term=${term}`
    );

    // Load student report card remarks/position
    const cardRes = await apiRequest<ReportCardStatusRow>(
      `/report-cards/${student.id}?academicYearId=${selectedClass.academicYearId}&term=${term}`
    );

    if (scoresRes.success && scoresRes.data) {
      setPreviewData({
        scores: scoresRes.data,
        summary: cardRes.success ? cardRes.data : null,
      });
    }

    setLoadingPreview(false);
  };

  // Compute stats averages
  const classAverages = () => {
    let classSum = 0;
    let examSum = 0;
    let totalSum = 0;
    let count = 0;

    students.forEach((std) => {
      const s = scores[std.id];
      if (s) {
        const cNum = parseFloat(s.classScore);
        const eNum = parseFloat(s.examScore);
        if (!isNaN(cNum) && !isNaN(eNum)) {
          classSum += cNum;
          examSum += eNum;
          totalSum += parseFloat(((cNum * 0.3) + (eNum * 0.7)).toFixed(2));
          count++;
        }
      }
    });

    return {
      classAvg: count > 0 ? (classSum / count).toFixed(1) : "--",
      examAvg: count > 0 ? (examSum / count).toFixed(1) : "--",
      totalAvg: count > 0 ? (totalSum / count).toFixed(1) : "--",
    };
  };

  const { classAvg, examAvg, totalAvg } = classAverages();

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100 relative">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-primary-500" />
            <span>Gradebook & Terminal Reports</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Compile Continuous Assessment (30%) + Exam Score (70%) sheets and compile terminal reports.
          </p>
        </div>

        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider self-start sm:self-center ${
          isOnline ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
        }`}>
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 shrink-0" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Offline Draft Mode</span>
            </>
          )}
        </div>
      </div>

      {/* Selectors layout */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-4 gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Class Stream</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full bg-slate-950/45 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Academic Term</label>
          <select
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full bg-slate-950/45 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
          >
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">NaCCA Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            disabled={subjects.length === 0}
            className="w-full bg-slate-950/45 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subjects.length === 0 ? (
              <option value="">No Subjects Placed</option>
            ) : (
              subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  [{sub.code}] {sub.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={saveSubjectScores}
            disabled={savingScores || !selectedSubjectId || students.length === 0}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {savingScores ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Saving Scores...</span>
              </>
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                <span>Save Subject Scores</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm animate-shake">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {hasDraft && isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Offline Draft Detected</p>
              <p className="text-slate-400">You have unsaved offline marks. Sync them to the server to persist.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-center">
            <button
              onClick={syncOfflineDraft}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Sync Draft
            </button>
            <button
              onClick={discardOfflineDraft}
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Main Grid content split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Score Grid Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <h3 className="font-extrabold text-white text-base">Roster Entry Sheets</h3>
              <div className="flex space-x-3 text-[11px] font-semibold text-slate-400">
                <span>Class Size: {students.length}</span>
                <span>•</span>
                <span>Active Level: {getSelectedClass()?.level}</span>
              </div>
            </div>

            {loadingRoster ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
              </div>
            ) : students.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                No students enrolled in this class stream.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-5 text-left w-12">#</th>
                      <th className="py-3 px-4 text-left">Student Name</th>
                      <th className="py-3 px-4 text-center w-24">Class (30)</th>
                      <th className="py-3 px-4 text-center w-24">Exam (70)</th>
                      <th className="py-3 px-4 text-center w-20">Total</th>
                      <th className="py-3 px-4 text-center w-20">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {students.map((std, idx) => {
                      const stdScore = scores[std.id] || { classScore: "", examScore: "" };
                      const stats = getLiveStats(std.id);

                      return (
                        <tr key={std.id} className="hover:bg-slate-850/15 transition-colors">
                          <td className="py-3 px-5 font-mono text-slate-500 text-xs">{idx + 1}.</td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-white text-sm">
                              {std.firstName} {std.middleName ? `${std.middleName} ` : ""}{std.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{std.emisNumber || "No EMIS Number"}</p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="Class"
                              value={stdScore.classScore}
                              onChange={(e) => handleScoreChange(std.id, "classScore", e.target.value)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1.5 px-2 text-xs font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="Exam"
                              value={stdScore.examScore}
                              onChange={(e) => handleScoreChange(std.id, "examScore", e.target.value)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1.5 px-2 text-xs font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-sm text-slate-300">
                            {stats.total}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 border text-[10px] font-extrabold uppercase rounded-md tracking-wider ${stats.color}`}>
                              {stats.grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Subject average footer bar */}
            {!loadingRoster && students.length > 0 && (
              <div className="bg-slate-950/40 p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Subject Class Averages:</span>
                <div className="flex space-x-5 font-mono">
                  <span>Class: <strong className="text-white">{classAvg}</strong></span>
                  <span>Exam: <strong className="text-white">{examAvg}</strong></span>
                  <span>Overall Total: <strong className="text-primary-400">{totalAvg}%</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Report Card Generator Sidebar controls */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <h4 className="font-extrabold text-white text-base">Terminal Report Generator</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compile continuous scores and compute final positioning and aggregate indexes class-wide.
            </p>

            {/* Dates controls */}
            <div className="space-y-4 border-y border-slate-800/60 py-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Term Start / End Date</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={termStartDate}
                    onChange={(e) => setTermStartDate(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="date"
                    value={termEndDate}
                    onChange={(e) => setTermEndDate(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Next Term Begins</label>
                <input
                  type="date"
                  value={nextTermBegins}
                  onChange={(e) => setNextTermBegins(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Run Button (Headteacher restricted) */}
            {isHeadteacher ? (
              <button
                type="button"
                onClick={triggerReportsGeneration}
                disabled={generatingReports || pollingReports || students.length === 0}
                className="w-full bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm shadow-md shadow-primary-500/10"
              >
                {generatingReports || pollingReports ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    <span>Compiling PDF Sheets...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4.5 w-4.5" />
                    <span>Compile Class Report Cards</span>
                  </>
                )}
              </button>
            ) : (
              <div className="bg-amber-500/5 border border-amber-500/10 text-amber-400/90 text-xs p-3.5 rounded-xl flex items-start space-x-2 leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>Notice: Only the Headteacher can execute class-wide positioning calculations and terminal PDF compilations.</span>
              </div>
            )}

            {/* Progress Polling Logs Status */}
            {pollingReports && (
              <div className="space-y-2.5 animate-pulse bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-primary-400 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating PDFs...
                  </span>
                  <span className="text-slate-500">
                    {reportCards.filter((r) => r.status === "completed").length} / {reportCards.length}
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-850 rounded-full h-1.5">
                  <div
                    className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(reportCards.filter((r) => r.status === "completed").length / reportCards.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Bulk Download ZIP button */}
            {reportCards.some((r) => r.status === "completed") && (
              <button
                type="button"
                onClick={downloadAllPdfsZip}
                className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-750 text-slate-100 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer text-sm shadow animate-fadeIn"
              >
                <Download className="h-4.5 w-4.5 text-slate-400" />
                <span>Download Compiled ZIP ({reportCards.filter((r) => r.status === "completed").length} PDFs)</span>
              </button>
            )}
          </div>

          {/* Report Card Customizer Card (Visible to headteacher) */}
          {isHeadteacher && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl animate-fadeIn">
              <div>
                <h4 className="font-extrabold text-white text-base">Report Card Customization</h4>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Upload school logo, stamp, and headteacher signature files to customize terminal reports.
                </p>
              </div>

              {loadingSettings && !schoolSettings ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* School Logo */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">School Logo</label>
                    <div className="flex items-center space-x-4">
                      <div className="h-14 w-14 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {schoolSettings?.logoUrl ? (
                          <img src={schoolSettings.logoUrl} alt="Logo Preview" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="text-[10px] text-slate-600 font-bold">No Logo</span>
                        )}
                      </div>
                      <label className="flex-1 cursor-pointer">
                        <span className="inline-flex items-center justify-center px-3 py-1.5 border border-slate-850 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-slate-950/40 hover:bg-slate-850 transition-all select-none">
                          <Upload className="h-3 w-3 mr-1.5 text-slate-400" />
                          Upload Logo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleAssetUpload("logo", e.target.files[0]);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Headteacher Signature */}
                  <div className="space-y-2 pt-4 border-t border-slate-850">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Headteacher Signature</label>
                    <div className="flex items-center space-x-4">
                      <div className="h-14 w-28 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 p-1">
                        {schoolSettings?.headteacherSignatureUrl ? (
                          <img src={schoolSettings.headteacherSignatureUrl} alt="Signature Preview" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-600 font-bold">No Signature</span>
                        )}
                      </div>
                      <label className="flex-1 cursor-pointer">
                        <span className="inline-flex items-center justify-center px-3 py-1.5 border border-slate-850 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-slate-950/40 hover:bg-slate-850 transition-all select-none">
                          <Upload className="h-3 w-3 mr-1.5 text-slate-400" />
                          Upload Signature
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleAssetUpload("signature", e.target.files[0]);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* School Stamp */}
                  <div className="space-y-2 pt-4 border-t border-slate-850">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">School Stamp</label>
                    <div className="flex items-center space-x-4">
                      <div className="h-16 w-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 p-1">
                        {schoolSettings?.schoolStampUrl ? (
                          <img src={schoolSettings.schoolStampUrl} alt="Stamp Preview" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-600 font-bold">No Stamp</span>
                        )}
                      </div>
                      <label className="flex-1 cursor-pointer">
                        <span className="inline-flex items-center justify-center px-3 py-1.5 border border-slate-850 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-slate-950/40 hover:bg-slate-850 transition-all select-none">
                          <Upload className="h-3 w-3 mr-1.5 text-slate-400" />
                          Upload Stamp
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleAssetUpload("stamp", e.target.files[0]);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Overlay Certification Preview */}
                  {schoolSettings?.headteacherSignatureUrl && schoolSettings?.schoolStampUrl && (
                    <div className="pt-4 border-t border-slate-850">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Overlay Certification Preview</p>
                      <div className="h-24 bg-white/[0.02] border border-slate-850 rounded-2xl flex items-center justify-center relative overflow-hidden select-none">
                        {/* Signature (base) */}
                        <img
                          src={schoolSettings.headteacherSignatureUrl}
                          alt="Signature Overlay"
                          className="h-10 object-contain z-10"
                        />
                        {/* Stamp (overlapping, rotated, partial opacity) */}
                        <img
                          src={schoolSettings.schoolStampUrl}
                          alt="Stamp Overlay"
                          className="h-16 w-16 object-contain absolute opacity-75 z-20 pointer-events-none transform -rotate-6 translate-x-4 -translate-y-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Student Status Grid List */}
          {students.length > 0 && !loadingRoster && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <h4 className="font-bold text-white text-sm">Class Report Index</h4>
              <div className="divide-y divide-slate-850 max-h-96 overflow-y-auto pr-1">
                {students.map((std) => {
                  const card = reportCards.find((r) => r.studentId === std.id) || {
                    status: "pending" as const,
                    classPosition: null,
                    aggregate: null,
                    pdfUrl: null,
                  };

                  return (
                    <div key={std.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="truncate">
                        <p className="font-semibold text-slate-200 truncate">{std.firstName} {std.lastName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {card.classPosition ? `Pos: ${card.classPosition} | Agg: ${card.aggregate || "--"}` : "Uncompiled"}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Custom comments/remarks triggers */}
                        <button
                          type="button"
                          onClick={() => openRemarksModal(card as any)}
                          title="Edit Remarks"
                          className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openStudentPreview(std)}
                          title="Preview Report card"
                          className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {card.pdfUrl && (
                          <a
                            href={card.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-primary-500/10 hover:bg-primary-500/20 p-1.5 rounded-lg text-primary-400 hover:text-primary-300 transition-all"
                            title="Open compiled PDF"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. EDIT REMARKS MODAL */}
      {activeRemarksStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <h4 className="font-extrabold text-white text-base">Edit Comments & Remarks</h4>
              <button
                onClick={() => setActiveRemarksStudent(null)}
                className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400">
                Update details for <strong className="text-slate-100">{activeRemarksStudent.studentFirstName} {activeRemarksStudent.studentLastName}</strong> before compiling PDFs.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Class Teacher's Remarks</label>
                <textarea
                  value={remarksTeacher}
                  onChange={(e) => setRemarksTeacher(e.target.value)}
                  placeholder="e.g. A pleasant and hardworking student. Keep it up!"
                  className="w-full bg-slate-950/45 border border-slate-850 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Headteacher's Remarks</label>
                <textarea
                  value={remarksHead}
                  onChange={(e) => setRemarksHead(e.target.value)}
                  placeholder="e.g. Very good results. Approved for promotion."
                  className="w-full bg-slate-950/45 border border-slate-850 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-slate-850">
                <span className="text-xs text-slate-400 font-semibold">Promotion Decision (Term 3)</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setRemarksPromoted(true)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      remarksPromoted === true
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-950 text-slate-400 border border-slate-800"
                    }`}
                  >
                    Promoted
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemarksPromoted(false)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      remarksPromoted === false
                        ? "bg-rose-500 text-white"
                        : "bg-slate-950 text-slate-400 border border-slate-800"
                    }`}
                  >
                    Retained
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border-t border-slate-850 flex justify-end space-x-3">
              <button
                onClick={() => setActiveRemarksStudent(null)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveRemarks}
                disabled={savingRemarks}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer flex items-center space-x-1"
              >
                {savingRemarks && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Save Remarks</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REPORT CARD PREVIEW MODAL */}
      {activePreviewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <h4 className="font-extrabold text-white text-base">Individual Report Card Preview</h4>
              <button
                onClick={() => {
                  setActivePreviewStudent(null);
                  setPreviewData(null);
                }}
                className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
              {loadingPreview ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
                </div>
              ) : !previewData ? (
                <div className="text-center py-10 text-slate-400">
                  No continuous assessment sheets compiled for this student this term.
                </div>
              ) : (
                <div className="bg-white text-slate-900 p-5 rounded-2xl border-4 border-double border-slate-950 space-y-4 font-sans text-xs">
                  <div className="text-center border-b-2 border-slate-900 pb-3">
                    <h5 className="text-base font-extrabold uppercase tracking-tight text-slate-950">
                      Terminal Progress Card
                    </h5>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold mt-1">
                      Student: {activePreviewStudent.firstName} {activePreviewStudent.lastName}
                    </p>
                  </div>

                  {/* meta grid preview */}
                  <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded-lg text-[10px] bg-slate-50">
                    <div>
                      <p className="mb-1"><strong>Class Stream:</strong> {getSelectedClass()?.name}</p>
                      <p><strong>Student ID / EMIS:</strong> {activePreviewStudent.emisNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="mb-1"><strong>Term:</strong> {term}</p>
                      <p><strong>Academic Year:</strong> {getSelectedClass()?.name ? "2025/2026" : ""}</p>
                    </div>
                  </div>

                  {/* score table preview */}
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] text-slate-700 font-bold uppercase border-b border-slate-300">
                        <th className="p-2 text-left border-r border-slate-300">Subject</th>
                        <th className="p-2 text-center border-r border-slate-300 w-16">Class (30)</th>
                        <th className="p-2 text-center border-r border-slate-300 w-16">Exam (70)</th>
                        <th className="p-2 text-center border-r border-slate-300 w-16">Total</th>
                        <th className="p-2 text-center w-12">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewData.scores.map((sc: any) => (
                        <tr key={sc.id} className="border-b border-slate-200">
                          <td className="p-2 border-r border-slate-200 font-semibold">{sc.subjectName}</td>
                          <td className="p-2 border-r border-slate-200 text-center">{parseFloat(String(sc.classScore))}</td>
                          <td className="p-2 border-r border-slate-200 text-center">{parseFloat(String(sc.examScore))}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold">{parseFloat(String(sc.total))}</td>
                          <td className="p-2 text-center font-extrabold">{sc.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Summary aggregate info */}
                  {previewData.summary && (
                    <div className="border border-slate-300 p-3 rounded-lg flex justify-between bg-slate-50 text-[10px]">
                      <span>Class Position: <strong>{previewData.summary.classPosition || "--"}</strong></span>
                      <span>Term Aggregate: <strong>{previewData.summary.aggregate || "--"}</strong></span>
                      <span>Promotion: <strong>{previewData.summary.promoted === true ? "PROMOTED" : previewData.summary.promoted === false ? "RETAINED" : "N/A"}</strong></span>
                    </div>
                  )}

                  {/* remarks preview */}
                  <div className="space-y-2 text-[10px] border-t border-slate-200 pt-3">
                    <p><strong>Teacher's Remarks:</strong> <em>"{previewData.summary?.teacherRemarks || "A satisfactory term's performance."}"</em></p>
                    <p><strong>Headteacher's Remarks:</strong> <em>"{previewData.summary?.headRemarks || "Approved."}"</em></p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950/30 border-t border-slate-850 flex justify-end">
              <button
                onClick={() => {
                  setActivePreviewStudent(null);
                  setPreviewData(null);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Gradebook;
