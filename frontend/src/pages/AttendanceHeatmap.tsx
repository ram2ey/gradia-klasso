import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest } from "../services/api";
import { ArrowLeft, Loader2 } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  session: "morning" | "afternoon";
  status: "present" | "absent" | "late" | "excused";
  note: string | null;
}

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  emisNumber: string | null;
}

export const AttendanceHeatmap: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Current calendar month view state
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    const fetchHistory = async () => {
      if (!studentId) return;
      setLoading(true);
      setError(null);

      // 1. Fetch student info
      const studentRes = await apiRequest<{ student: StudentInfo }>(`/students/${studentId}`);
      if (studentRes.success && studentRes.data) {
        setStudent(studentRes.data.student);
      } else {
        setError(studentRes.error || "Failed to load student context.");
        setLoading(false);
        return;
      }

      // 2. Fetch history records (last 3 months range)
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);

      const toStr = toDate.toISOString().split("T")[0];
      const fromStr = fromDate.toISOString().split("T")[0];

      const res = await apiRequest<AttendanceRecord[]>(
        `/attendance/student/${studentId}?from=${fromStr}&to=${toStr}`
      );
      
      setLoading(false);
      if (res.success && res.data) {
        setRecords(res.data);
      } else {
        setError(res.error || "Failed to load attendance logs.");
      }
    };

    fetchHistory();
  }, [studentId]);

  // Calculate stats
  const totalSessions = records.length;
  const presentCount = records.filter((r) => r.status === "present").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const excusedCount = records.filter((r) => r.status === "excused").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const presenceRatio = totalSessions > 0 ? Math.round(((presentCount + lateCount + excusedCount) / totalSessions) * 100) : 100;

  // Calendar rendering helper
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  // Generates day items
  const calendarDays: { dayNum: number | null; dateStr: string | null }[] = [];
  // Add empty slots for offset
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ dayNum: null, dateStr: null });
  }
  // Add day slots
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({ dayNum: d, dateStr: dStr });
  }

  // Get status of a date (combining morning and afternoon)
  const getDateStatus = (dateStr: string) => {
    const dayRecords = records.filter((r) => r.date === dateStr);
    if (dayRecords.length === 0) return "none";

    // If any session is absent, highlight it as absent or resolve to average
    const statuses = dayRecords.map((r) => r.status);
    if (statuses.includes("absent")) return "absent";
    if (statuses.includes("late")) return "late";
    if (statuses.includes("excused")) return "excused";
    return "present";
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  if (loading && !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="p-8 max-w-lg mx-auto space-y-4 text-center">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          {error}
        </div>
        <Link to="/students" className="text-primary-400 hover:underline">Return to Directory</Link>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto text-slate-100">
      {/* Title */}
      <div className="flex items-center space-x-3">
        <Link to={`/students/${student.id}`} className="bg-slate-800 hover:bg-slate-750 p-2.5 rounded-xl text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Attendance Register</h2>
          <p className="text-xs text-slate-400">Heatmap tracking presence history for {student.firstName} {student.lastName}.</p>
        </div>
      </div>

      {/* Grid wrapper */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Calendar Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={handlePrevMonth}
                className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Prev
              </button>
              <button
                onClick={handleNextMonth}
                className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>

          {/* Week Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((slot, idx) => {
              if (slot.dayNum === null || slot.dateStr === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const status = getDateStatus(slot.dateStr);
              let colorClass = "bg-slate-850 text-slate-400 border border-slate-800/60";

              if (status === "present") colorClass = "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold";
              else if (status === "absent") colorClass = "bg-red-500/10 border border-red-500/30 text-red-400 font-bold";
              else if (status === "late") colorClass = "bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold";
              else if (status === "excused") colorClass = "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold";

              return (
                <div
                  key={slot.dateStr}
                  title={slot.dateStr}
                  className={`aspect-square flex items-center justify-center rounded-xl text-xs transition-all ${colorClass}`}
                >
                  {slot.dayNum}
                </div>
              );
            })}
          </div>

          {/* Color coding legend */}
          <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-t border-slate-850 pt-4">
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-md bg-emerald-500/20 border border-emerald-500/30" />
              <span>Present</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-md bg-amber-500/20 border border-amber-500/30" />
              <span>Late</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-md bg-red-500/20 border border-red-500/30" />
              <span>Absent</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-md bg-indigo-500/20 border border-indigo-500/30" />
              <span>Excused</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-md bg-slate-850 border border-slate-800" />
              <span>No Record</span>
            </div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h4 className="font-extrabold text-white text-base">Roster Summary</h4>

          <div className="space-y-4">
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Attendance Percentage</p>
              <h5 className="text-3xl font-black text-white mt-1">{presenceRatio}%</h5>
              <p className="text-[10px] text-slate-400 mt-1">Based on {totalSessions} logged sessions</p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850/50">
                <span className="text-slate-500">Present Sessions</span>
                <span className="font-semibold text-emerald-400">{presentCount}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850/50">
                <span className="text-slate-500">Late Sessions</span>
                <span className="font-semibold text-amber-400">{lateCount}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850/50">
                <span className="text-slate-500">Excused Sessions</span>
                <span className="font-semibold text-indigo-400">{excusedCount}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850/50">
                <span className="text-slate-500">Absent Sessions</span>
                <span className="font-semibold text-red-400">{absentCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AttendanceHeatmap;
