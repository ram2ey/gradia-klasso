import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import {
  User,
  BookOpen,
  Trash2,
  Printer,
  AlertTriangle,
  CheckCircle,
  Plus,
  Loader2,
  Sparkles,
  ArrowLeft,
  X,
  Edit2
} from "lucide-react";
import { Link } from "react-router-dom";

// Types matching backend/schema
interface Period {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  sortOrder: number;
}

interface TimetableEntry {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: number;
  periodId: string;
  subjectName: string;
  subjectCode: string;
  teacherFirstName?: string;
  teacherLastName?: string;
  className?: string; // used for teacher schedules
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface ClassItem {
  id: string;
  name: string;
  level: number;
}

interface Conflict {
  teacherId: string;
  teacherFirstName: string;
  teacherLastName: string;
  dayOfWeek: number;
  periodId: string;
  periodName: string;
  class1Id: string;
  class1Name: string;
  class2Id: string;
  class2Name: string;
  entry1Id: string;
  entry2Id: string;
}

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }
];

export const Timetable: React.FC = () => {
  const { user } = useAuth();
  
  // App context state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"class" | "teacher">("class");
  
  // Selections
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  
  // Timetable grid data
  const [periods, setPeriods] = useState<Period[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  
  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  
  // Assignment Modal / Side Panel State
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [modalCell, setModalCell] = useState<{ dayOfWeek: number; period: Period; entry?: TimetableEntry } | null>(null);
  const [modalSubjectId, setModalSubjectId] = useState<string>("");
  const [modalTeacherId, setModalTeacherId] = useState<string>("");

  const isHeadteacher = user?.role === "headteacher";

  // Fetch initial configuration data (classes, teachers, audit conflicts)
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      
      // Fetch classes
      const classRes = await apiRequest<ClassItem[]>("/classes");
      if (classRes.success && classRes.data) {
        setClasses(classRes.data);
        if (classRes.data.length > 0) {
          setSelectedClassId(classRes.data[0].id);
        }
      }
      
      // Fetch teachers (for scheduler selection)
      if (isHeadteacher || user?.role === "class_teacher") {
        const teacherRes = await apiRequest<Teacher[]>("/timetable/teachers");
        if (teacherRes.success && teacherRes.data) {
          setTeachers(teacherRes.data);
          if (teacherRes.data.length > 0) {
            setSelectedTeacherId(teacherRes.data[0].id);
          }
        }
      }
      
      setLoading(false);
    };
    
    fetchConfig();
  }, [user]);

  // Fetch subjects whenever the selected class changes (Ghana NaCCA syllabus maps to class grade levels)
  useEffect(() => {
    const fetchClassSubjects = async () => {
      if (!selectedClassId || viewMode !== "class") return;
      const subjectsRes = await apiRequest<Subject[]>(`/subjects?classId=${selectedClassId}`);
      if (subjectsRes.success && subjectsRes.data) {
        setSubjects(subjectsRes.data);
      }
    };
    
    fetchClassSubjects();
  }, [selectedClassId, viewMode]);

  // Load schedule entries depending on filters (Class weekly view vs Teacher weekly view)
  const loadTimetable = async () => {
    if (viewMode === "class" && !selectedClassId) return;
    if (viewMode === "teacher" && !selectedTeacherId) return;
    
    setLoading(true);
    setError(null);
    
    let endpoint = "";
    if (viewMode === "class") {
      endpoint = `/timetable/class/${selectedClassId}`;
    } else {
      endpoint = `/timetable/teacher/${selectedTeacherId}`;
    }
    
    const res = await apiRequest<{ periods: Period[]; entries: TimetableEntry[] }>(endpoint);
    
    if (res.success && res.data) {
      setPeriods(res.data.periods);
      setEntries(res.data.entries);
    } else {
      setError(res.error || "Failed to load timetable.");
    }
    
    // Fetch conflicts (if admin/teacher)
    if (isHeadteacher || user?.role === "class_teacher") {
      const conflictRes = await apiRequest<Conflict[]>("/timetable/conflicts");
      if (conflictRes.success && conflictRes.data) {
        setConflicts(conflictRes.data);
      }
    }
    
    setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setLoading(false);
  };

  useEffect(() => {
    loadTimetable();
  }, [selectedClassId, selectedTeacherId, viewMode]);

  // Drag and Drop (HTML5 API) handlers
  const handleDragStart = (e: React.DragEvent, subjectId: string) => {
    e.dataTransfer.setData("subjectId", subjectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dayOfWeek: number, period: Period) => {
    e.preventDefault();
    if (!isHeadteacher || period.isBreak) return;
    
    const subjectId = e.dataTransfer.getData("subjectId");
    if (!subjectId) return;
    
    // Find if slot already exists
    const existingEntry = entries.find((en) => en.dayOfWeek === dayOfWeek && en.periodId === period.id);
    
    openAssignModal(dayOfWeek, period, subjectId, existingEntry);
  };

  // Assign Modal opener
  const openAssignModal = (dayOfWeek: number, period: Period, defaultSubjectId = "", existingEntry?: TimetableEntry) => {
    setModalCell({ dayOfWeek, period, entry: existingEntry });
    setModalSubjectId(existingEntry?.subjectId || defaultSubjectId);
    setModalTeacherId(existingEntry?.teacherId || "");
    setShowAssignModal(true);
  };

  // Save changes to timetable slot
  const handleSaveEntry = async () => {
    if (!modalCell) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    const payload = {
      id: modalCell.entry?.id,
      classId: selectedClassId,
      subjectId: modalSubjectId,
      teacherId: modalTeacherId || null,
      dayOfWeek: modalCell.dayOfWeek,
      periodId: modalCell.period.id,
    };
    
    const res = await apiRequest("/timetable/entry", {
      method: "POST",
      body: payload,
    });
    
    setSaving(false);
    
    if (res.success) {
      setSuccess("Timetable slot updated successfully!");
      setShowAssignModal(false);
      loadTimetable(); // Reload grid
    } else {
      setError(res.error || "Failed to save timetable slot.");
    }
  };

  // Remove timetable slot entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm("Are you sure you want to remove this timetable entry?")) return;
    
    setSaving(true);
    setError(null);
    
    const res = await apiRequest(`/timetable/entry/${entryId}`, {
      method: "DELETE",
    });
    
    setSaving(false);
    
    if (res.success) {
      setSuccess("Timetable slot deleted successfully!");
      setShowAssignModal(false);
      loadTimetable(); // Reload grid
    } else {
      setError(res.error || "Failed to delete timetable slot.");
    }
  };

  // Highlight conflicting slots
  const getConflictForSlot = (dayOfWeek: number, periodId: string, entryId?: string) => {
    if (!entryId) return null;
    return conflicts.find(
      (c) =>
        c.dayOfWeek === dayOfWeek &&
        c.periodId === periodId &&
        (c.entry1Id === entryId || c.entry2Id === entryId)
    );
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Build grid data for rendering
  const getEntryAt = (dayOfWeek: number, periodId: string) => {
    return entries.find((e) => e.dayOfWeek === dayOfWeek && e.periodId === periodId);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100 relative print:p-0">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 print:hidden">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5 flex-wrap">
            <Sparkles className="h-6.5 w-6.5 text-ghana-gold shrink-0" />
            <span>Class Scheduler & Timetable</span>
            {lastSynced && (
              <span className="text-[10px] font-semibold text-slate-500 font-mono mt-1 sm:mt-0">
                (Last Synced: {lastSynced})
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400">
            Manage teacher lectures, allocate NaCCA classroom subjects, and audit schedule conflicts.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <Link
            to="/dashboard"
            className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-gradient-to-tr from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Layout</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm print:hidden">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-xl flex items-center space-x-3 text-sm print:hidden">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Scheduler Selectors Filter Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">View Type</label>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => setViewMode("class")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "class" ? "bg-primary-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Class Streams
              </button>
              <button
                type="button"
                onClick={() => setViewMode("teacher")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "teacher" ? "bg-primary-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Teachers Schedule
              </button>
            </div>
          </div>

          {viewMode === "class" ? (
            <div className="min-w-[180px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Level {c.level})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Teacher</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.role === "headteacher" ? "Headteacher" : "Class Teacher"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isHeadteacher && viewMode === "class" && (
          <div className="text-right hidden md:block">
            <span className="text-xs text-slate-400 leading-relaxed max-w-xs block font-medium">
              💡 Drag subjects from the side panel and drop them directly into grid slots to schedule!
            </span>
          </div>
        )}
      </div>

      {/* Main Grid View Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
        
        {/* Timetable main grid */}
        <div className={`lg:col-span-3 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 overflow-hidden backdrop-blur-md print:border-none print:bg-transparent print:p-0 ${viewMode === "teacher" || !isHeadteacher ? "lg:col-span-4" : ""}`}>
          
          {/* Print Title Header */}
          <div className="hidden print:block mb-6 text-black">
            <h1 className="text-2xl font-bold text-center">
              {viewMode === "class"
                ? `Weekly Timetable - Class ${classes.find((c) => c.id === selectedClassId)?.name || ""}`
                : `Weekly Schedule - Teacher ${teachers.find((t) => t.id === selectedTeacherId)?.firstName || ""} ${teachers.find((t) => t.id === selectedTeacherId)?.lastName || ""}`
              }
            </h1>
            <p className="text-center text-xs text-gray-600 mt-1">Gradia Klasso School Management System</p>
          </div>

          {loading ? (
            <div className="py-24 flex flex-col justify-center items-center space-y-3">
              <Loader2 className="h-9 w-9 text-primary-500 animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Loading weekly schedule...</p>
            </div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-slate-800/80 print:border-black">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 print:bg-gray-100 print:text-black print:border-black">
                    <th className="p-4.5 text-xs font-bold uppercase tracking-wider w-36 border-r border-slate-800 print:border-black">Time Slot</th>
                    {DAYS.map((day) => (
                      <th
                        key={day.value}
                        className="p-4.5 text-xs font-bold uppercase tracking-wider text-center border-r border-slate-800 last:border-0 print:border-black"
                      >
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm print:divide-black">
                  {periods.map((period) => {
                    if (period.isBreak) {
                      return (
                        <tr
                          key={period.id}
                          className="bg-slate-950/40 select-none text-slate-500 font-bold uppercase tracking-wider text-center print:bg-gray-50 print:text-black print:border-black"
                        >
                          <td className="p-3 text-[10px] text-left border-r border-slate-800 font-mono text-slate-500 print:border-black">
                            {period.startTime.slice(0, 5)} - {period.endTime.slice(0, 5)}
                          </td>
                          <td colSpan={5} className="p-3 text-center text-xs">
                            ☕ {period.name}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={period.id}
                        className="hover:bg-slate-850/10 transition-colors print:hover:bg-transparent print:border-black"
                      >
                        <td className="p-4 font-mono text-xs text-slate-400 border-r border-slate-800 align-middle space-y-0.5 print:text-black print:border-black">
                          <p className="font-bold text-white print:text-black">{period.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1 print:text-gray-600">
                            {period.startTime.slice(0, 5)} - {period.endTime.slice(0, 5)}
                          </p>
                        </td>

                        {DAYS.map((day) => {
                          const entry = getEntryAt(day.value, period.id);
                          const conflict = getConflictForSlot(day.value, period.id, entry?.id);
                          const cellHasConflict = !!conflict;
                          
                          return (
                            <td
                              key={day.value}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, day.value, period)}
                              className={`p-3 text-center border-r border-slate-800 last:border-0 align-middle relative transition-colors min-h-[70px] w-48 print:border-black ${
                                isHeadteacher && viewMode === "class"
                                  ? "hover:bg-primary-500/5 cursor-pointer"
                                  : ""
                              } ${cellHasConflict ? "bg-red-500/10 border-red-500/30" : ""}`}
                              onClick={() => {
                                if (isHeadteacher && viewMode === "class") {
                                  openAssignModal(day.value, period, "", entry);
                                }
                              }}
                            >
                              {entry ? (
                                <div className="space-y-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 relative group shadow-sm print:bg-transparent print:border-none print:shadow-none">
                                  <div className="font-bold text-white text-xs tracking-tight print:text-black">
                                    {entry.subjectName}
                                  </div>
                                  <div className="text-[10px] text-primary-400 font-mono print:text-gray-800">
                                    {entry.subjectCode}
                                  </div>
                                  
                                  {viewMode === "class" ? (
                                    <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1 mt-1 print:text-gray-700">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span className="truncate">
                                        {entry.teacherFirstName
                                          ? `${entry.teacherFirstName} ${entry.teacherLastName}`
                                          : "No Teacher"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-1 print:text-gray-900">
                                      Class: {entry.className}
                                    </div>
                                  )}

                                  {/* Conflict Badge */}
                                  {cellHasConflict && (
                                    <div
                                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full shadow border border-slate-900 cursor-help flex items-center justify-center print:border-none"
                                      title={`Conflict! ${conflict.teacherFirstName} ${conflict.teacherLastName} is double-booked with class ${conflict.class1Id === selectedClassId ? conflict.class2Name : conflict.class1Name}`}
                                    >
                                      <AlertTriangle className="h-2.5 w-2.5 text-white" />
                                    </div>
                                  )}

                                  {/* Actions overlay for admin */}
                                  {isHeadteacher && viewMode === "class" && (
                                    <div className="absolute inset-0 bg-slate-950/80 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-2 transition-opacity duration-150 no-print">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openAssignModal(day.value, period, "", entry);
                                        }}
                                        className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteEntry(entry.id);
                                        }}
                                        className="p-1.5 bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-700 italic select-none py-4 no-print">
                                  {isHeadteacher && viewMode === "class" ? (
                                    <span className="text-slate-600 group hover:text-slate-400 flex items-center justify-center space-x-0.5">
                                      <Plus className="h-3 w-3 shrink-0" />
                                      <span>Add Slot</span>
                                    </span>
                                  ) : (
                                    <span>Empty</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Subjects list planner sidebar (Headteacher edit mode only) */}
        {isHeadteacher && viewMode === "class" && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-5 space-y-6 h-fit no-print">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-400" />
                Syllabus Subjects
              </h3>
              <p className="text-xs text-slate-400">
                Drag a subject and drop it onto the weekly grid to schedule a slot.
              </p>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/45 rounded-xl border border-slate-850 p-4 text-xs text-slate-500">
                No syllabus subjects mapped to this class level.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, sub.id)}
                    className="p-3 bg-slate-950 border border-slate-850 hover:border-primary-500/50 hover:bg-slate-900 rounded-xl cursor-grab active:cursor-grabbing transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-xs text-white group-hover:text-primary-400 transition-colors">
                        {sub.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Code: {sub.code}
                      </p>
                    </div>
                    <div className="p-1 bg-slate-900 rounded-md text-slate-500 text-[10px] font-bold">
                      DRAG
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Read-only audit box for conflicts */}
            {conflicts.length > 0 && (
              <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Schedule Clashes</span>
                </div>
                <div className="text-[11px] text-red-300 space-y-2 max-h-[150px] overflow-y-auto">
                  {conflicts.map((c, idx) => (
                    <div key={idx} className="border-b border-red-500/10 pb-2 last:border-0 last:pb-0">
                      <span className="font-bold text-white">Teacher double-booked: </span>
                      {c.teacherFirstName} {c.teacherLastName} is scheduled in both <span className="font-semibold text-white">{c.class1Name}</span> and <span className="font-semibold text-white">{c.class2Name}</span> on {DAYS.find(d => d.value === c.dayOfWeek)?.label} ({c.periodName}).
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Assignment Modal dialog */}
      {showAssignModal && modalCell && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-scaleUp">
            
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-white text-base">Configure Timetable Slot</h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {DAYS.find((d) => d.value === modalCell.dayOfWeek)?.label} - {modalCell.period.name} ({modalCell.period.startTime.slice(0, 5)} - {modalCell.period.endTime.slice(0, 5)})
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Subject selector */}
              <div>
                <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Subject</label>
                <select
                  value={modalSubjectId}
                  onChange={(e) => setModalSubjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  <option value="">Select a Subject...</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Teacher selector */}
              <div>
                <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Assigned Teacher</label>
                <select
                  value={modalTeacherId}
                  onChange={(e) => setModalTeacherId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  <option value="">Unassigned (No Teacher)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div>
                {modalCell.entry && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(modalCell.entry!.id)}
                    className="flex items-center space-x-1 text-red-400 hover:text-red-300 text-xs font-bold transition-all p-2 rounded-xl hover:bg-red-500/5 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Entry</span>
                  </button>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 hover:text-white font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEntry}
                  disabled={saving || !modalSubjectId}
                  className="px-5 py-2.5 bg-gradient-to-tr from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
export default Timetable;
