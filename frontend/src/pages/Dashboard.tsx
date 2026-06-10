import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  GraduationCap,
  LogOut,
  Users,
  BookOpen,
  Calendar,
  CreditCard,
  Bell,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Award,
  Wallet,
  Clock
} from "lucide-react";
import NotificationBell from "../components/NotificationBell";
import OfflineBanner from "../components/OfflineBanner";
import { getOfflineQueue, flushOfflineQueue } from "../utils/offlineDb";

export const Dashboard: React.FC = () => {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();

  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    // 1. Visit tracking for installation prompt
    const visits = parseInt(localStorage.getItem("gradia_visits") || "0", 10);
    const newVisits = visits + 1;
    localStorage.setItem("gradia_visits", String(newVisits));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install banner on 2nd visit or later
      if (newVisits >= 2) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as any);

    const handleAppInstalled = () => {
      console.log("[PWA]: App was installed successfully!");
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // 2. Queue sync triggers & change listeners
    const updateQueueCount = async () => {
      const queue = await getOfflineQueue();
      setPendingSyncCount(queue.length);
    };
    updateQueueCount();

    const handleQueueChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setPendingSyncCount(customEvent.detail.count || 0);
    };
    window.addEventListener("gradia-offline-queue-changed", handleQueueChange);

    const handleOnlineEvent = async () => {
      const stats = await flushOfflineQueue();
      if (stats.synced > 0) {
        console.log(`[PWA]: Re-established connection; synced ${stats.synced} offline actions.`);
      }
    };
    window.addEventListener("online", handleOnlineEvent);

    // Proactively sync queue if online on load
    if (navigator.onLine) {
      flushOfflineQueue();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("gradia-offline-queue-changed", handleQueueChange);
      window.removeEventListener("online", handleOnlineEvent);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA]: User install prompt selection: ${outcome}`);
    setShowInstallBanner(false);
    setDeferredPrompt(null);
  };

  if (!user || !school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p className="animate-pulse">Loading workspace context...</p>
      </div>
    );
  }

  // Get display role label
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "headteacher":
        return "Headteacher (Admin)";
      case "class_teacher":
        return "Class Teacher";
      case "bursar":
        return "Bursar (Finance)";
      case "parent":
        return "Parent Context";
      case "student":
        return "Student Context";
      default:
        return role;
    }
  };

  const isHeadteacher = user.role === "headteacher";
  const isTeacher = user.role === "class_teacher";

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800/80 p-6 justify-between">
        <div className="space-y-8">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-ghana-green to-ghana-gold p-2 rounded-xl text-slate-950">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Gradia Klasso
            </span>
          </div>

          <nav className="space-y-1.5">
            <Link to="/dashboard" className="flex items-center space-x-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 px-4 py-3 rounded-xl text-sm font-semibold transition-all">
              <BookOpen className="h-4.5 w-4.5" />
              <span>Workspace</span>
            </Link>
            <Link to="/students" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
              <Users className="h-4.5 w-4.5" />
              <span>Students</span>
            </Link>
            {(isHeadteacher || isTeacher) && (
              <>
                <Link to="/roster" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
                  <FileSpreadsheet className="h-4.5 w-4.5" />
                  <span>Class Roster</span>
                </Link>
                <Link to="/attendance" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
                  <Calendar className="h-4.5 w-4.5" />
                  <span>Daily Attendance</span>
                </Link>
              </>
            )}
            <Link to="/grades" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
              <Award className="h-4.5 w-4.5" />
              <span>Grades & NaCCA</span>
            </Link>
            <Link to="/payments" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
              <Wallet className="h-4.5 w-4.5" />
              <span>Payments (Hubtel)</span>
            </Link>
             <Link to="/notifications" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
              <Bell className="h-4.5 w-4.5" />
              <span>Notifications</span>
            </Link>
            <Link to="/timetable" className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-xl text-sm font-medium transition-all">
              <Clock className="h-4.5 w-4.5" />
              <span>Timetable</span>
            </Link>
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 text-slate-400 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>Exit Workspace</span>
        </button>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <OfflineBanner />
        {/* Header */}
        <header className="bg-slate-900/40 border-b border-slate-800/60 p-4 md:px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center space-x-3 md:space-x-0">
            {/* Mobile Title */}
            <div className="md:hidden bg-gradient-to-tr from-ghana-green to-ghana-gold p-1.5 rounded-lg text-slate-950">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">{school.name}</h1>
              <p className="text-xs text-slate-500 font-mono">{school.subdomain}.gradia.edu</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {pendingSyncCount > 0 && (
              <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-400 animate-pulse" title={`${pendingSyncCount} pending offline sync actions`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>{pendingSyncCount} Pending Sync</span>
              </div>
            )}
            <NotificationBell />
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex items-center space-x-3 text-left">
              <div className="bg-gradient-to-br from-primary-400 to-sky-600 h-9 w-9 rounded-xl flex items-center justify-center font-bold text-slate-950 text-sm shadow-md">
                {`${user.firstName[0] || ""}${user.lastName[0] || ""}`.toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user.firstName} {user.lastName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{getRoleLabel(user.role)}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="md:hidden text-slate-400 hover:text-red-400 transition-colors p-1"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Dashboard Grid Container */}
        <div className="p-6 md:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {showInstallBanner && (
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-primary-500/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div className="space-y-1">
                <h4 className="font-extrabold text-white text-base">Install Gradia Klasso App</h4>
                <p className="text-xs text-slate-300">
                  Access the school portal directly from your home screen with full offline capability.
                </p>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={handleInstallClick}
                  className="bg-gradient-to-r from-sky-500 to-teal-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  Install Now
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="text-slate-400 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Welcome Panel */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 p-6 sm:p-8 shadow-xl">
            {/* National highlight corner decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-ghana-gold/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10 space-y-4 max-w-2xl">
              <span className="bg-primary-500/10 text-primary-400 border border-primary-500/20 px-3 py-1 rounded-full text-xs font-semibold tracking-wider">
                Ghana Private Basic Schools Standard
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Akwaaba, {user.firstName}!
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Welcome to your school administration workspace. Everything is set up for compiling NaCCA standard continuous assessment reports, collecting parent payments, and tracking EMIS student profiles.
              </p>
            </div>
          </div>

          {/* Academic Calendar & Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Academic Year Info */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center space-x-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Academic Term</p>
                <p className="text-sm font-bold text-white mt-1">Term 3 (May - July)</p>
                <p className="text-xs text-slate-400">Year: 2025/2026</p>
              </div>
            </div>

            {/* Total Students */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Enrollment</p>
                <p className="text-sm font-bold text-white mt-1">0 Students registered</p>
                <p className="text-xs text-slate-400">Basic 1 to Basic 9 (JHS 3)</p>
              </div>
            </div>

            {/* Hubtel Payments Status */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hubtel Payment Gateway</p>
                <p className="text-sm font-bold text-white mt-1">Status: Standby</p>
                <p className="text-xs text-emerald-400 flex items-center mt-0.5">
                  <TrendingUp className="h-3 w-3 mr-1" /> Ready for MoMo
                </p>
              </div>
            </div>

            {/* Service Worker PWA Status */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center space-x-4">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Offline Cache Status</p>
                <p className="text-sm font-bold text-white mt-1">PWA Service Worker</p>
                <p className="text-xs text-slate-400">Offline mode enabled</p>
              </div>
            </div>
          </div>

          {/* Quick Actions (Role-Specific) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Quick Administrative Shortcuts</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1 */}
              <Link to="/students" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/60 transition-all group flex flex-col justify-between h-40">
                <div>
                  <h4 className="font-bold text-white text-base">Student Database</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Register students, assign classes, and set EMIS numbers (Ghana Education Service IDs).
                  </p>
                </div>
                <div className="flex items-center justify-between text-primary-400 text-xs font-bold pt-4">
                  <span>View Student Roster</span>
                  <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Card 2 */}
              <Link to="/roster" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/60 transition-all group flex flex-col justify-between h-40">
                <div>
                  <h4 className="font-bold text-white text-base">Class Streams</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Track class lists, teacher assignments, and active year enrollments.
                  </p>
                </div>
                <div className="flex items-center justify-between text-ghana-gold text-xs font-bold pt-4">
                  <span>Manage Classrooms</span>
                  <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Card 3 */}
              <Link to="/payments" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/60 transition-all group flex flex-col justify-between h-40">
                <div>
                  <h4 className="font-bold text-white text-base">Bursary & Billing</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Configure school fees, manage active terms billing, and connect Hubtel payments API.
                  </p>
                </div>
                <div className="flex items-center justify-between text-emerald-400 text-xs font-bold pt-4">
                  <span>Access Ledger</span>
                  <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
export default Dashboard;
