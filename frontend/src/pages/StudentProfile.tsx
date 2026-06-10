import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { ArrowLeft, User, Phone, Mail, MapPin, Building, Calendar, ShieldAlert, CheckCircle, ArrowRightLeft, Upload } from "lucide-react";
import axiosInstance from "../services/axiosInstance";

interface StudentDetails {
  id: string;
  emisNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  photoUrl: string | null;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  guardianRelationship: string;
  homeAddress: string;
  previousSchool: string | null;
}

interface ClassPlacement {
  id: string;
  name: string;
  level: number;
}

interface ProfileResponse {
  student: StudentDetails;
  placement: {
    enrolment: { id: string; status: string };
    class: ClassPlacement;
  } | null;
}

interface ClassItem {
  id: string;
  name: string;
}

export const StudentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [placement, setPlacement] = useState<ProfileResponse["placement"]>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [transferClassId, setTransferClassId] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Fetch Student Profile
  const fetchProfile = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await apiRequest<ProfileResponse>(`/students/${id}`);
    setLoading(false);

    if (res.success && res.data) {
      setStudent(res.data.student);
      setPlacement(res.data.placement);
    } else {
      setError(res.error || "Failed to load student profile.");
    }
  };

  // Fetch Classes for transfers
  const fetchClasses = async () => {
    const res = await apiRequest<ClassItem[]>("/classes");
    if (res.success && res.data) {
      setClasses(res.data);
      if (res.data.length > 0) {
        setTransferClassId(res.data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
    if (user?.role === "headteacher") {
      fetchClasses();
    }
  }, [id]);

  // Handle image upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const formData = new FormData();
    formData.append("photo", file);

    setPhotoUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use axiosInstance directly to support raw FormData header requirements
      const response = await axiosInstance.post(`/students/${id}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPhotoUploading(false);
      if (response.data.success && response.data.data) {
        setSuccess("Profile photo updated successfully!");
        setStudent((prev) => prev ? { ...prev, photoUrl: response.data.data.photoUrl } : null);
      } else {
        setError(response.data.error || "Failed to upload photo.");
      }
    } catch (err: any) {
      setPhotoUploading(false);
      setError(err.message || "Failed to upload photo.");
    }
  };

  // Handle transfer submissions
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !transferClassId) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await apiRequest(`/students/${id}/transfer`, {
      method: "PUT",
      body: { classId: transferClassId },
    });

    setLoading(false);

    if (res.success) {
      setSuccess("Student successfully transferred to new class stream!");
      fetchProfile();
    } else {
      setError(res.error || "Failed to process class transfer.");
    }
  };

  const isHeadteacher = user?.role === "headteacher";

  if (loading && !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
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
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto text-slate-100">
      {/* Navigation and Title */}
      <div className="flex items-center space-x-3">
        <Link to="/students" className="bg-slate-800 hover:bg-slate-750 p-2.5 rounded-xl text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Student Profile</h2>
          <p className="text-xs text-slate-400">Manage placement records, photos, and guardian demographics.</p>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main card splits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Image Card & Current Placement */}
        <div className="space-y-6 md:col-span-1">
          {/* Profile Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-5 relative">
            {/* National highlight corner decoration */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-ghana-gold/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative mx-auto w-32 h-32 group">
              {student.photoUrl ? (
                <img
                  src={`http://localhost:5000${student.photoUrl}`}
                  alt={`${student.firstName} profile`}
                  className="w-32 h-32 rounded-2xl object-cover border border-slate-800"
                />
              ) : (
                <div className="bg-slate-850 border border-slate-800 text-slate-500 w-32 h-32 rounded-2xl flex items-center justify-center font-bold text-3xl">
                  {student.firstName[0]}
                  {student.lastName[0]}
                </div>
              )}

              {/* Photo Uploader Overlay */}
              <label className="absolute inset-0 bg-slate-950/70 border border-dashed border-primary-500/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-5 w-5 text-primary-400 animate-bounce" />
                <span className="text-[10px] text-slate-300 font-semibold mt-1">
                  {photoUploading ? "Uploading..." : "Upload Photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <h3 className="font-extrabold text-white text-lg">
                {student.firstName} {student.middleName ? `${student.middleName} ` : ""}{student.lastName}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1">{student.emisNumber || "No EMIS Number Assigned"}</p>
            </div>

            <div className="h-px bg-slate-850" />

            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Gender:</span>
                <span className="font-semibold text-slate-300">{student.gender}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Birthday:</span>
                <span className="font-semibold text-slate-300">
                  {new Date(student.dateOfBirth).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Current Class Placement */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider text-slate-400">Class Placement</h4>
            {placement ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 bg-slate-850 border border-slate-800 p-3 rounded-xl">
                  <Building className="h-5 w-5 text-ghana-gold" />
                  <div>
                    <p className="text-xs text-slate-500">Current Stream</p>
                    <h5 className="font-bold text-white text-sm">{placement.class.name}</h5>
                  </div>
                </div>
                <div className="flex items-center space-x-3 bg-slate-850 border border-slate-800 p-3 rounded-xl">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-xs text-slate-500">Placement Status</p>
                    <h5 className="font-bold text-white text-sm capitalize">{placement.enrolment.status}</h5>
                  </div>
                </div>
                <Link
                  to={`/students/${student.id}/attendance`}
                  className="w-full bg-slate-850 hover:bg-slate-800 border border-slate-800 text-primary-400 hover:text-primary-300 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer text-xs"
                >
                  <Calendar className="h-4 w-4 text-ghana-gold" />
                  <span>View Attendance Register</span>
                </Link>
              </div>
            ) : (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                This student is not enrolled in any class stream for the active year.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Demographics & Class Transfer tools */}
        <div className="md:col-span-2 space-y-6">
          {/* Guardian Info & Address Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h4 className="font-extrabold text-white text-lg tracking-tight">Guardian & Demographics</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Guardian Name</p>
                <div className="flex items-center space-x-2.5 mt-1.5">
                  <User className="h-4.5 w-4.5 text-slate-500" />
                  <span className="font-semibold text-slate-200">{student.guardianName} ({student.guardianRelationship})</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Guardian Phone</p>
                <div className="flex items-center space-x-2.5 mt-1.5">
                  <Phone className="h-4.5 w-4.5 text-slate-500" />
                  <span className="font-semibold text-slate-200">{student.guardianPhone}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Guardian Email</p>
                <div className="flex items-center space-x-2.5 mt-1.5">
                  <Mail className="h-4.5 w-4.5 text-slate-500" />
                  <span className="font-semibold text-slate-200">{student.guardianEmail || "None Provided"}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Previous School attended</p>
                <div className="flex items-center space-x-2.5 mt-1.5">
                  <Building className="h-4.5 w-4.5 text-slate-500" />
                  <span className="font-semibold text-slate-200">{student.previousSchool || "None / Fresh Intake"}</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-850" />

            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Home / Residential Address</p>
              <div className="flex items-start space-x-2.5 mt-1.5">
                <MapPin className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm leading-relaxed">{student.homeAddress}</span>
              </div>
            </div>
          </div>

          {/* Transfer Form (Headteacher Only) */}
          {isHeadteacher && placement && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center space-x-2 text-primary-400">
                <ArrowRightLeft className="h-5 w-5 text-ghana-gold" />
                <h4 className="font-extrabold text-white text-lg tracking-tight">Transfer Stream Placement</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Relocate Ama to another class stream. The current placement will be set to "withdrawn" and a new active link created.
              </p>

              <form onSubmit={handleTransferSubmit} className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-xs text-slate-500 font-semibold mb-1.5">Select Destination Stream</label>
                  <select
                    value={transferClassId}
                    onChange={(e) => setTransferClassId(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                  >
                    {classes
                      .filter((c) => c.id !== placement.class.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm shrink-0 w-full sm:w-auto"
                >
                  Execute Transfer
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default StudentProfile;
