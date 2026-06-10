import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GraduationCap, Mail, Lock, Building, AlertCircle } from "lucide-react";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [schoolLocator, setSchoolLocator] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password, schoolLocator);

    setLoading(false);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Failed to sign in. Please verify your credentials.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      {/* Background glow overlays */}
      <div className="absolute top-[-15%] left-[-15%] w-[450px] h-[450px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[450px] h-[450px] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-10 backdrop-blur-md shadow-2xl relative">
        {/* Ghana flag subtle top highlight */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex rounded-t-3xl overflow-hidden">
          <div className="w-1/3 bg-ghana-red h-full" />
          <div className="w-1/3 bg-ghana-gold h-full" />
          <div className="w-1/3 bg-ghana-green h-full" />
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700/50 p-3.5 rounded-2xl text-primary-400 shadow-md">
            <GraduationCap className="h-7 w-7 text-ghana-gold" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-4">Welcome Back</h2>
          <p className="text-slate-400 text-sm mt-1.5 text-center">
            Sign in to access your Gradia Klasso school workspace.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm mb-6 animate-shake">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* School locator */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">School Code or Subdomain</label>
            <div className="flex rounded-xl bg-slate-850 border border-slate-800 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent transition-all overflow-hidden bg-slate-950/40">
              <span className="pl-3.5 flex items-center text-slate-500">
                <Building className="h-5 w-5" />
              </span>
              <input
                type="text"
                required
                placeholder="e.g. morningstar OR GES-1002"
                value={schoolLocator}
                onChange={(e) => setSubdomainValue(e.target.value)}
                className="flex-1 bg-transparent py-3 pl-2.5 pr-4 text-white placeholder-slate-600 focus:outline-none text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">Enter your school subdomain identifier or GES code.</p>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="name@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-slate-300">Password</label>
              <a href="#forgot" className="text-xs text-primary-400 hover:underline">Forgot password?</a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg hover:shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm mt-2"
          >
            <span>{loading ? "Signing In..." : "Access Workspace"}</span>
          </button>
        </form>

        <div className="text-center text-sm text-slate-500 mt-8">
          <span>Need to register a new school? </span>
          <Link to="/onboard" className="text-primary-400 hover:underline font-semibold transition-colors">
            Onboard here
          </Link>
        </div>
      </div>
    </div>
  );

  // Helper setter keeping values sanitized or matching
  function setSubdomainValue(val: string) {
    if (val.includes("-") || /^[a-zA-Z0-9]+$/.test(val)) {
      setSchoolLocator(val);
    } else {
      setSchoolLocator(val.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    }
  }
};
export default Login;
