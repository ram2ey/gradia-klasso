import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { addPendingAttendance, flushPendingAttendance } from "../utils/offlineDb";
import { Calendar, AlertTriangle, CheckCircle, Wifi, WifiOff, Save, Loader2 } from "lucide-react";

interface StudentRosterItem {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface ExistingAttendanceRecord {
  studentId: string;
  status: "present" | "absent" | "late" | "excused";
  note: string | null;
}

export const AttendanceEntry: React.FC = () => {
  const { user } = useAuth();
  
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]); // YYYY-MM-DD
  const [session, setSession] = useState<"morning" | "afternoon">("morning");
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { status: "present" | "absent" | "late" | "excused"; note: string }>>({});
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const flushedCount = await flushPendingAttendance();
      if (flushedCount > 0) {
        setSuccess(`Back online! Synced ${flushedCount} pending offline attendance records.`);
      }
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

  // Fetch classes
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

  // Load roster and existing attendance logs
  useEffect(() => {
    const loadRosterAndLogs = async () => {
      if (!selectedClassId) return;
      setLoading(true);
      setError(null);
      setSuccess(null);
      setShowOverridePrompt(false);

      // 1. Fetch Class Roster
      const rosterRes = await apiRequest<StudentRosterItem[]>(`/students?classId=${selectedClassId}`);
      if (!rosterRes.success || !rosterRes.data) {
        setError(rosterRes.error || "Failed to load class roster.");
        setLoading(false);
        return;
      }
      setStudents(rosterRes.data);

      // Initialize default Present statuses
      const initialMap: Record<string, { status: "present" | "absent" | "late" | "excused"; note: string }> = {};
      rosterRes.data.forEach((std) => {
        initialMap[std.id] = { status: "present", note: "" };
      });

      // 2. Attempt to fetch existing marks (if online)
      if (isOnline) {
        const logsRes = await apiRequest<ExistingAttendanceRecord[]>(
          `/attendance/class/${selectedClassId}?date=${date}&session=${session}`
        );
        if (logsRes.success && logsRes.data && logsRes.data.length > 0) {
          logsRes.data.forEach((log) => {
            initialMap[log.studentId] = { status: log.status, note: log.note || "" };
          });
          setSuccess("Existing attendance records loaded for this session.");
        }
      } else {
        setError("Offline mode active: Cannot verify if attendance was already submitted. Submissions will queue locally.");
      }

      setAttendance(initialMap);
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLoading(false);
    };

    loadRosterAndLogs();
  }, [selectedClassId, date, session, isOnline]);

  const handleStatusChange = (studentId: string, status: "present" | "absent" | "late" | "excused") => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], note },
    }));
  };

  // Submits the marked log
  const handleSubmission = async (forceOverride = false) => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const recordArray = students.map((std) => ({
      studentId: std.id,
      status: attendance[std.id]?.status || "present",
      note: attendance[std.id]?.note || undefined,
    }));

    // Offline mode: Queue in IndexedDB
    if (!isOnline) {
      try {
        await addPendingAttendance(selectedClassId, date, session, recordArray);
        setSuccess("Attendance saved offline. Records will sync automatically when internet connection returns.");
        setSubmitting(false);
      } catch (err: any) {
        setError(err.message || "Failed to save record offline.");
        setSubmitting(false);
      }
      return;
    }

    // Online mode: Submit to backend
    const response = await apiRequest("/attendance/bulk", {
      method: "POST",
      body: {
        classId: selectedClassId,
        date,
        session,
        records: recordArray,
        forceOverride,
      },
    });

    setSubmitting(false);

    if (response.success) {
      setSuccess("Attendance records submitted successfully!");
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setShowOverridePrompt(false);
    } else {
      // Handle override prompt warning for headteacher
      if (response.meta && response.meta.warning && user?.role === "headteacher") {
        setShowOverridePrompt(true);
        setError("Warning: Attendance has already been submitted for this session. Do you wish to override?");
      } else {
        setError(response.error || "Failed to record attendance logs.");
      }
    }
  };

  // Calculates present count for button summary
  const presentCount = Object.values(attendance).filter((a) => a.status === "present" || a.status === "late" || a.status === "excused").length;
  const absentCount = Object.values(attendance).filter((a) => a.status === "absent").length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto text-slate-100 relative">
      {/* Offline/Online indicators */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-baseline">
            <span>Daily Attendance</span>
            {lastSynced && (
              <span className="text-[10px] font-semibold text-slate-500 font-mono ml-3">
                (Last Synced: {lastSynced})
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Record student presence metrics per morning/afternoon session.</p>
        </div>

        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
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
              <span>Offline Mode Active</span>
            </>
          )}
        </div>
      </div>

      {/* Class picker, Date picker, session toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
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
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Date</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950/45 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">School Session</label>
          <div className="grid grid-cols-2 gap-2 bg-slate-950/45 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSession("morning")}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                session === "morning" ? "bg-primary-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Morning
            </button>
            <button
              type="button"
              onClick={() => setSession("afternoon")}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                session === "afternoon" ? "bg-primary-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Afternoon
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm animate-shake">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <span>{error}</span>
            {showOverridePrompt && (
              <div className="flex space-x-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleSubmission(true)}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Yes, Override Records
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverridePrompt(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Roster list marking cards */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-400">
          No students are placed in the selected class stream.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
            <div className="divide-y divide-slate-850">
              {students.map((std, idx) => {
                const marker = attendance[std.id] || { status: "present", note: "" };
                
                return (
                  <div key={std.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-850/20 transition-colors">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono text-slate-500 w-6">{idx + 1}.</span>
                      <span className="font-semibold text-white">
                        {std.firstName} {std.middleName ? `${std.middleName} ` : ""}{std.lastName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Note Input */}
                      <input
                        type="text"
                        placeholder="Add note..."
                        value={marker.note}
                        onChange={(e) => handleNoteChange(std.id, e.target.value)}
                        className="bg-slate-950/40 border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full sm:w-40"
                      />

                      {/* Status select Toggles */}
                      <div className="flex bg-slate-950/60 p-1 border border-slate-800/80 rounded-xl">
                        {(["present", "absent", "late", "excused"] as const).map((st) => (
                          <button
                            type="button"
                            key={st}
                            onClick={() => handleStatusChange(std.id, st)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              marker.status === st
                                ? st === "present"
                                  ? "bg-emerald-500 text-white shadow"
                                  : st === "absent"
                                  ? "bg-red-500 text-white shadow"
                                  : st === "late"
                                  ? "bg-amber-500 text-slate-950 shadow"
                                  : "bg-indigo-500 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => handleSubmission(false)}
              disabled={submitting}
              className="bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg hover:shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Submitting Logs...</span>
                </>
              ) : (
                <>
                  <Save className="h-4.5 w-4.5" />
                  <span>Mark {presentCount} Present & {absentCount} Absent</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AttendanceEntry;
