import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../services/api";
import { GraduationCap, ArrowRight, ArrowLeft, User, Phone, MapPin, Hash, CheckCircle2, AlertCircle } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
}

export const StudentEnrolForm: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "Male",
    emisNumber: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "Mother",
    homeAddress: "",
    previousSchool: "",
    classId: "",
  });

  // Fetch classes for dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      const res = await apiRequest<ClassItem[]>("/classes");
      const data = res.data;
      if (res.success && data) {
        setClasses(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, classId: data[0].id }));
        }
      }
    };
    fetchClasses();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await apiRequest("/students", {
      method: "POST",
      body: formData,
    });

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/students");
      }, 3000);
    } else {
      setError(result.error || "Failed to enrol student. Please check input parameters.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-15%] left-[-15%] w-[450px] h-[450px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[450px] h-[450px] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl relative">
        {/* Flag highlights */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex rounded-t-3xl overflow-hidden">
          <div className="w-1/3 bg-ghana-red h-full" />
          <div className="w-1/3 bg-ghana-gold h-full" />
          <div className="w-1/3 bg-ghana-green h-full" />
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800 p-2.5 rounded-xl text-primary-400">
              <GraduationCap className="h-6 w-6 text-ghana-gold" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Enrol Student</h2>
              <p className="text-xs text-slate-400 mt-0.5">Step {step} of 3: {step === 1 ? "Personal Profile" : step === 2 ? "Guardian Details" : "Class Placement"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-2.5 w-8 rounded-full transition-all duration-300 ${
                  s === step ? "bg-primary-500" : s < step ? "bg-emerald-500/60" : "bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm mb-6">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-6 rounded-2xl text-center space-y-3">
            <div className="mx-auto bg-emerald-500/20 w-12 h-12 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <h4 className="font-bold text-lg text-white">Student Registered Successfully!</h4>
            <p className="text-sm text-slate-400">
              Roster profile established. Redirecting to student list...
            </p>
          </div>
        )}

        {!success && (
          <form onSubmit={step === 3 ? handleSubmit : handleNext} className="space-y-6">
            {/* Step 1: Student Demographics */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      placeholder="e.g. Ama"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Middle Name (Optional)</label>
                    <input
                      type="text"
                      name="middleName"
                      placeholder="e.g. Serwaa"
                      value={formData.middleName}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      placeholder="e.g. Mensah"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      required
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">EMIS GES Number (Optional)</label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="text"
                        name="emisNumber"
                        placeholder="e.g. 10029302"
                        value={formData.emisNumber}
                        onChange={handleChange}
                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Previous School (Optional)</label>
                    <input
                      type="text"
                      name="previousSchool"
                      placeholder="e.g. St. Peters Prep"
                      value={formData.previousSchool}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Guardian Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Guardian Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="text"
                        name="guardianName"
                        required
                        placeholder="e.g. Emmanuel Mensah"
                        value={formData.guardianName}
                        onChange={handleChange}
                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Guardian Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="text"
                        name="guardianPhone"
                        required
                        placeholder="e.g. +233 24 000 0000"
                        value={formData.guardianPhone}
                        onChange={handleChange}
                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Guardian Email (Optional)</label>
                    <input
                      type="email"
                      name="guardianEmail"
                      placeholder="e.g. guardian@mail.com"
                      value={formData.guardianEmail}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Relationship to Student</label>
                    <select
                      name="guardianRelationship"
                      value={formData.guardianRelationship}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Uncle">Uncle</option>
                      <option value="Aunt">Aunt</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Residential Home Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <textarea
                      name="homeAddress"
                      required
                      placeholder="e.g. GA-102-3849, Adentan, Accra"
                      value={formData.homeAddress}
                      onChange={handleChange}
                      rows={3}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Class Placements */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Select Placement Stream</label>
                  {classes.length === 0 ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl text-sm">
                      No classes are defined for the current academic year. You must create class streams first.
                    </div>
                  ) : (
                    <select
                      name="classId"
                      value={formData.classId}
                      onChange={handleChange}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="bg-slate-800/40 border border-slate-800/60 p-4 rounded-2xl text-xs text-slate-400 space-y-2 leading-relaxed">
                  <h5 className="font-bold text-slate-300">Enrolment Placement Terms</h5>
                  <p>
                    By submitting this registration, the student will be placed into the selected active stream under the current academic term. An active registration record will be created.
                  </p>
                </div>
              </div>
            )}

            {/* Action panel */}
            <div className="flex space-x-3 pt-4 border-t border-slate-800/60">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all border border-slate-700/60 cursor-pointer"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="submit"
                disabled={loading || (step === 3 && classes.length === 0)}
                className="flex-1 bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg hover:shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{step === 3 ? (loading ? "Placing Student..." : "Submit Enrolment") : "Continue"}</span>
                {step < 3 && <ArrowRight className="h-4.5 w-4.5" />}
              </button>
            </div>
          </form>
        )}

        <div className="text-center text-sm text-slate-500 mt-6">
          <Link to="/students" className="hover:underline text-slate-400 font-medium">
            Cancel and Return
          </Link>
        </div>
      </div>
    </div>
  );
};
export default StudentEnrolForm;
