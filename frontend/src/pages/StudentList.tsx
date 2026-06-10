import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { Search, Filter, Plus, User, FileText, AlertCircle } from "lucide-react";

interface StudentListItem {
  id: string;
  emisNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string;
  guardianName: string;
  guardianPhone: string;
  photoUrl: string | null;
  className: string | null;
  enrolmentStatus: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  level: number;
}

export const StudentList: React.FC = () => {
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Classes for filter
  useEffect(() => {
    const fetchClasses = async () => {
      const res = await apiRequest<ClassItem[]>("/classes");
      if (res.success && res.data) {
        setClasses(res.data);
      }
    };
    fetchClasses();
  }, []);

  // 2. Fetch Students list
  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (selectedClass) query.append("classId", selectedClass);
    if (search) query.append("search", search);

    const res = await apiRequest<StudentListItem[]>(`/students?${query.toString()}`);
    setLoading(false);

    if (res.success && res.data) {
      setStudents(res.data);
    } else {
      setError(res.error || "Failed to load student profiles.");
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents();
  };

  const isHeadteacher = user?.role === "headteacher";

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Student Directory</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage student registrations, class assignments, and GES records.
          </p>
        </div>

        {isHeadteacher && (
          <Link
            to="/students/enrol"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3 px-5 rounded-xl transition-all hover:shadow-lg hover:shadow-primary-500/20 cursor-pointer text-sm"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Enrol New Student</span>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center gap-4 backdrop-blur-sm">
        <form onSubmit={handleSearchSubmit} className="w-full md:flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search students by first/last name or EMIS number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-24 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="w-full md:w-64 flex items-center space-x-3">
          <Filter className="h-4.5 w-4.5 text-slate-500 shrink-0" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-slate-950/45 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid listing */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-16 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-slate-800/60 rounded-full flex items-center justify-center text-slate-400">
            <User className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-lg text-white">No students found</h4>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            {search || selectedClass
              ? "We couldn't find any student matching your query. Adjust search or select another class stream."
              : "No student records are currently enrolled. Click Enrol Student to add records."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((std) => (
            <div
              key={std.id}
              className="bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all hover-lift relative"
            >
              {/* Top Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  {std.photoUrl ? (
                    <img
                      src={`http://localhost:5000${std.photoUrl}`}
                      alt={`${std.firstName} profile`}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-800"
                    />
                  ) : (
                    <div className="bg-slate-850 border border-slate-800 text-slate-400 w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg">
                      {std.firstName[0]}
                      {std.lastName[0]}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-white text-base leading-snug">
                      {std.firstName} {std.middleName ? `${std.middleName} ` : ""}{std.lastName}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {std.emisNumber || "No EMIS Code Assigned"}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-slate-800/50" />

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Placement Class</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{std.className || "Not Placed"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Gender</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{std.gender}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Guardian Contact</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{std.guardianName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Phone</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{std.guardianPhone}</p>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between">
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                  {std.enrolmentStatus || "Active"}
                </span>
                
                <Link
                  to={`/students/${std.id}`}
                  className="inline-flex items-center space-x-1.5 text-primary-400 hover:text-primary-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>View Details</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default StudentList;
