import React, { useState, useEffect } from "react";
import { apiRequest } from "../services/api";
import { Users, GraduationCap, Building2, AlertCircle, FileText } from "lucide-react";
import { Link } from "react-router-dom";

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
}

interface ClassItem {
  id: string;
  name: string;
  level: number;
  capacity: number;
}

export const ClassRoster: React.FC = () => {
  const [assignedClasses, setAssignedClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch classes assigned to teacher
  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      setError(null);
      
      const res = await apiRequest<ClassItem[]>("/classes");
      setLoading(false);

      if (res.success && res.data) {
        setAssignedClasses(res.data);
        if (res.data.length > 0) {
          setSelectedClass(res.data[0]);
        }
      } else {
        setError(res.error || "Failed to load class listings.");
      }
    };
    
    fetchClasses();
  }, []);

  // Fetch roster when selected class changes
  useEffect(() => {
    const fetchRoster = async () => {
      if (!selectedClass) return;
      setLoading(true);
      
      const res = await apiRequest<StudentListItem[]>(`/students?classId=${selectedClass.id}`);
      setLoading(false);

      if (res.success && res.data) {
        setStudents(res.data);
      } else {
        setError(res.error || "Failed to load student roster.");
      }
    };

    fetchRoster();
  }, [selectedClass]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value;
    const found = assignedClasses.find((c) => c.id === classId);
    if (found) {
      setSelectedClass(found);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Class Roster</h2>
          <p className="text-sm text-slate-400 mt-1">
            Roster listing of students currently placed in your class stream.
          </p>
        </div>

        {assignedClasses.length > 1 && (
          <div className="flex items-center space-x-3 shrink-0">
            <Building2 className="h-4.5 w-4.5 text-slate-500" />
            <select
              value={selectedClass?.id || ""}
              onChange={handleClassChange}
              className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              {assignedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && students.length === 0 ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : assignedClasses.length === 0 ? (
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-16 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-slate-800/60 rounded-full flex items-center justify-center text-slate-400">
            <Users className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-lg text-white">No Assigned Classes</h4>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            You are not registered as the class teacher of any stream for this term. Contact the Headteacher to update assignments.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Stats Card */}
          {selectedClass && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center space-x-4">
                <div className="p-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-xl">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Class Name</p>
                  <p className="text-base font-bold text-white mt-1">{selectedClass.name}</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Enrollment Ratio</p>
                  <p className="text-base font-bold text-white mt-1">
                    {students.length} / {selectedClass.capacity} Students Placed
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Roster Listing Grid */}
          {students.length === 0 ? (
            <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-12 text-center text-slate-400">
              No students are currently enrolled in this stream.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Student</th>
                    <th className="py-4 px-6">EMIS GES Code</th>
                    <th className="py-4 px-6">Gender</th>
                    <th className="py-4 px-6">Guardian Contact</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {students.map((std) => (
                    <tr key={std.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        {std.photoUrl ? (
                          <img
                            src={`http://localhost:5000${std.photoUrl}`}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-800"
                          />
                        ) : (
                          <div className="bg-slate-800 text-slate-400 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm">
                            {std.firstName[0]}
                            {std.lastName[0]}
                          </div>
                        )}
                        <span className="font-semibold text-white">
                          {std.firstName} {std.middleName ? `${std.middleName} ` : ""}{std.lastName}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400">
                        {std.emisNumber || "Unassigned"}
                      </td>
                      <td className="py-4 px-6 text-slate-300">{std.gender}</td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-slate-200">{std.guardianName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{std.guardianPhone}</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/students/${std.id}`}
                          className="inline-flex items-center space-x-1.5 text-primary-400 hover:text-primary-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                          <span>View Profile</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ClassRoster;
