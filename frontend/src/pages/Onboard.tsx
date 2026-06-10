import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, ArrowRight, ArrowLeft, Building2, Mail, Lock, User, CheckCircle2, AlertCircle, Phone, MapPin, Hash } from "lucide-react";
import { apiRequest } from "../services/api";

const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Eastern",
  "Central",
  "Northern",
  "Volta",
  "Upper East",
  "Upper West",
  "Savannah",
  "North East",
  "Bono",
  "Bono East",
  "Ahafo",
  "Oti",
  "Western North",
];

export const Onboard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    schoolName: "",
    subdomain: "",
    emisSchoolCode: "",
    region: "",
    district: "",
    circuit: "",
    address: "",
    phone: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "subdomain") {
      const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    setError(null);
    setLoading(true);

    const result = await apiRequest("/auth/onboard", {
      method: "POST",
      body: formData,
    });

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } else {
      setError(result.error || "An error occurred during onboarding.");
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100 overflow-hidden">
      {/* Left Column: Visual Splash */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex-col justify-between p-12 overflow-hidden">
        {/* Soft glowing ambient lights */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="relative z-10 flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-ghana-green to-ghana-gold p-2.5 rounded-xl text-slate-950 shadow-lg shadow-emerald-500/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Gradia Klasso
          </span>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Cloud-Native & PWA Ready</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight text-white">
            Transforming Basic School Management in Ghana
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            A premium, localized school management suite tailored for NaCCA curriculum, dynamic term structures, automated report cards, and integrated MoMo payments.
          </p>

          <div className="pt-4 grid grid-cols-2 gap-4">
            <div className="bg-slate-800/40 border border-slate-700/30 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="text-amber-400 font-bold text-lg">Ghanaian Grading</h3>
              <p className="text-xs text-slate-400">Built-in NaCCA system (Class 30% / Exam 70% splits)</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/30 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="text-emerald-400 font-bold text-lg">Hubtel Ready</h3>
              <p className="text-xs text-slate-400">Direct integration for MTN, Telecel, and AirtelTigo wallets</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Gradia Klasso. Enforcing GES and NaCCA Guidelines.
        </div>
      </div>

      {/* Right Column: Onboarding Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 relative overflow-y-auto max-h-screen">
        {/* Soft amber background glow for visual elegance */}
        <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[90px] pointer-events-none" />

        <div className="w-full max-w-lg space-y-8 relative z-10 py-8">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-between mb-4">
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Onboard Your School</h2>
              <span className="hidden sm:inline bg-slate-800 px-3 py-1 rounded-full text-xs font-semibold text-slate-400">
                Step {step} of 2
              </span>
            </div>
            <p className="text-slate-400 mt-2">
              {step === 1 
                ? "Enter your school's demographic and curricular details." 
                : "Create the primary administrator account (Headteacher)."}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm animate-shake">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-5 rounded-xl text-center space-y-3">
              <div className="mx-auto bg-emerald-500/20 w-12 h-12 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h4 className="font-bold text-lg text-white">School Created Successfully!</h4>
              <p className="text-sm text-slate-400">
                Onboarding complete. Redirecting you to login...
              </p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 1 && (
                <div className="space-y-4">
                  {/* School Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">School Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                      <input
                        type="text"
                        name="schoolName"
                        required
                        placeholder="e.g. Morning Star Academy"
                        value={formData.schoolName}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Subdomain */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">School Subdomain</label>
                    <div className="flex rounded-xl bg-slate-800 border border-slate-700/80 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent transition-all overflow-hidden">
                      <input
                        type="text"
                        name="subdomain"
                        required
                        placeholder="morningstar"
                        value={formData.subdomain}
                        onChange={handleChange}
                        className="flex-1 bg-transparent py-3 pl-4 pr-1 text-white placeholder-slate-500 focus:outline-none"
                      />
                      <span className="bg-slate-700/40 px-3.5 flex items-center text-sm font-medium text-slate-400 border-l border-slate-700/50">
                        .gradia.edu
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Only lowercase letters, numbers, and hyphens.</p>
                  </div>

                  {/* EMIS Code */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">EMIS School Code (Optional)</label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                      <input
                        type="text"
                        name="emisSchoolCode"
                        placeholder="e.g. GES-1002"
                        value={formData.emisSchoolCode}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Region Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Region (Ghana)</label>
                    <div className="relative">
                      <select
                        name="region"
                        value={formData.region}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      >
                        <option value="">Select Region...</option>
                        {GHANA_REGIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* District & Circuit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">District</label>
                      <input
                        type="text"
                        name="district"
                        placeholder="e.g. La Nkwantanang"
                        value={formData.district}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">Circuit</label>
                      <input
                        type="text"
                        name="circuit"
                        placeholder="e.g. Adentan Circuit 2"
                        value={formData.circuit}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone & Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">School Contact Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                        <input
                          type="text"
                          name="phone"
                          placeholder="e.g. +233 24 000 0000"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">Physical Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                        <input
                          type="text"
                          name="address"
                          placeholder="e.g. Digital Address / Street Name"
                          value={formData.address}
                          onChange={handleChange}
                          className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {/* First Name & Last Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">First Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                        <input
                          type="text"
                          name="firstName"
                          required
                          placeholder="Kofi"
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        placeholder="Annan"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Headteacher Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Admin Email (Login Email)</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="name@school.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Admin Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                      <input
                        type="password"
                        name="password"
                        required
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all border border-slate-700/60 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg hover:shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>{step === 1 ? "Next Step" : (loading ? "Creating School..." : "Complete Onboarding")}</span>
                  {step === 1 && <ArrowRight className="h-4 w-4" />}
                  {step === 2 && !loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>

              <div className="text-center text-sm text-slate-400 mt-4">
                <span>Already onboarded? </span>
                <Link to="/login" className="text-primary-400 hover:underline font-semibold transition-colors">
                  Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default Onboard;
