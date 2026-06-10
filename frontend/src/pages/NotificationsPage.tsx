import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Inbox,
  Megaphone,
  History,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Smartphone,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../services/api";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "fee_reminder" | "attendance_alert" | "result_published" | "announcement" | "general";
  isRead: boolean;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  channel: "sms" | "whatsapp" | "in_app";
  recipientPhone: string | null;
  message: string;
  status: "queued" | "sent" | "failed";
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

interface ClassStream {
  id: string;
  name: string;
  level: number;
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"inbox" | "broadcast" | "logs">("inbox");

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setChannels((c) => ({ ...c, sms: false, whatsapp: false }));
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auth roles flags
  const isHeadteacher = user?.role === "headteacher";
  const isBursar = user?.role === "bursar";
  const canBroadcast = isHeadteacher;
  const canViewLogs = isHeadteacher || isBursar;

  // Inbox state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Broadcast state
  const [classes, setClasses] = useState<ClassStream[]>([]);
  const [audience, setAudience] = useState<"all_parents" | "class" | "staff">("all_parents");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [channels, setChannels] = useState<{ sms: boolean; whatsapp: boolean; in_app: boolean }>({
    sms: true,
    whatsapp: false,
    in_app: true,
  });
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Logs state
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilterStatus, setLogsFilterStatus] = useState<string>("");
  const [logsFilterChannel, setLogsFilterChannel] = useState<string>("");

  // Fetch Inbox
  const fetchInbox = async (page: number) => {
    setInboxLoading(true);
    const res = await apiRequest<{ notifications: Notification[]; total: number }>(
      `/notifications?page=${page}&limit=15`
    );
    if (res.success && res.data) {
      setNotifications(res.data.notifications);
      setInboxTotal(res.data.total);
    }
    setInboxLoading(false);
  };

  // Fetch Delivery Logs
  const fetchLogs = async (page: number, status = "", channel = "") => {
    if (!canViewLogs) return;
    setLogsLoading(true);
    let url = `/notifications/delivery-log?page=${page}&limit=20`;
    if (status) url += `&status=${status}`;
    if (channel) url += `&channel=${channel}`;
    const res = await apiRequest<{ jobs: DeliveryLog[]; total: number }>(url);
    if (res.success && res.data) {
      setDeliveryLogs(res.data.jobs);
      setLogsTotal(res.data.total);
    }
    setLogsLoading(false);
  };

  // Fetch Classes for broadcast
  const fetchClasses = async () => {
    if (!canBroadcast) return;
    const res = await apiRequest<ClassStream[]>("/classes");
    if (res.success && res.data) {
      setClasses(res.data);
    }
  };

  useEffect(() => {
    if (activeTab === "inbox") {
      fetchInbox(inboxPage);
    } else if (activeTab === "logs") {
      fetchLogs(logsPage, logsFilterStatus, logsFilterChannel);
    } else if (activeTab === "broadcast") {
      fetchClasses();
    }
  }, [activeTab, inboxPage, logsPage, logsFilterStatus, logsFilterChannel]);

  // Mark all read
  const handleMarkAllRead = async () => {
    const res = await apiRequest("/notifications/read-all", { method: "PUT" });
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  // Send Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (!broadcastMessage.trim()) {
      setBroadcastError("Please write a message to broadcast.");
      return;
    }

    const selectedChannels = Object.entries(channels)
      .filter(([_, active]) => active)
      .map(([channel]) => channel);

    if (selectedChannels.length === 0) {
      setBroadcastError("Please select at least one dispatch channel.");
      return;
    }

    if (audience === "class" && !selectedClassId) {
      setBroadcastError("Please select a target class stream.");
      return;
    }

    setBroadcastLoading(true);

    const payload = {
      audience,
      classId: audience === "class" ? selectedClassId : undefined,
      title: broadcastTitle.trim() || undefined,
      message: broadcastMessage.trim(),
      channels: selectedChannels,
    };

    const res = await apiRequest("/notifications/announcements", {
      method: "POST",
      body: payload,
    });

    setBroadcastLoading(false);

    if (res.success) {
      setBroadcastSuccess(
        `Broadcast announcement successfully sent! ${res.data?.smsQueued || 0} SMS and ${
          res.data?.whatsappQueued || 0
        } WhatsApp messages queued.`
      );
      setBroadcastTitle("");
      setBroadcastMessage("");
      setSelectedClassId("");
    } else {
      setBroadcastError(res.error || "Failed to deliver broadcast announcement.");
    }
  };

  const getNotificationStyles = (type: Notification["type"]) => {
    switch (type) {
      case "fee_reminder":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "Fees",
        };
      case "attendance_alert":
        return {
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          label: "Attendance",
        };
      case "result_published":
        return {
          bg: "bg-sky-500/10 text-sky-400 border-sky-500/20",
          label: "Grades",
        };
      case "announcement":
        return {
          bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          label: "Announcement",
        };
      default:
        return {
          bg: "bg-slate-500/10 text-slate-400 border-slate-500/20",
          label: "Info",
        };
    }
  };

  const smsCharacterCount = broadcastMessage.length;
  const smsSegments = Math.ceil(smsCharacterCount / 160) || 1;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-200">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-ghana-gold" />
            Communication Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your alerts, broadcasts, and delivery logs in real-time.
          </p>
        </div>

        {/* Action button if inbox */}
        {activeTab === "inbox" && notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
          >
            <Check className="h-4 w-4" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-slate-900 border border-slate-800/80 p-1 rounded-2xl max-w-md">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "inbox"
              ? "bg-primary-500 text-white shadow-lg shadow-primary-500/10"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Inbox className="h-4 w-4" />
          <span>Inbox</span>
        </button>

        {canBroadcast && (
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "broadcast"
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Megaphone className="h-4 w-4" />
            <span>Broadcast</span>
          </button>
        )}

        {canViewLogs && (
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <History className="h-4 w-4" />
            <span>Logs</span>
          </button>
        )}
      </div>

      {/* Main Tab Panels */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl overflow-hidden backdrop-blur-md">
        
        {/* TAB 1: INBOX PANEL */}
        {activeTab === "inbox" && (
          <div className="p-6 space-y-6">
            {inboxLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
                <p className="text-xs text-slate-500 font-mono">Synchronizing notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                <div className="bg-slate-800 p-4 rounded-full text-slate-500 shadow-inner">
                  <Inbox className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-200">Inbox is empty</p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    You don't have any notifications at the moment. We will notify you when events occur.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3.5">
                  {notifications.map((n) => {
                    const styles = getNotificationStyles(n.type);
                    return (
                      <div
                        key={n.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col space-y-2 relative overflow-hidden ${
                          !n.isRead
                            ? "bg-slate-900/50 border-slate-700/60 shadow-lg shadow-primary-500/2"
                            : "bg-slate-950/20 border-slate-800/80"
                        }`}
                      >
                        {!n.isRead && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary-500" />
                        )}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold tracking-wide ${styles.bg}`}>
                            {styles.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <h4 className={`text-sm font-bold ${!n.isRead ? "text-white" : "text-slate-300"}`}>
                            {n.title}
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed mt-1">
                            {n.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {inboxTotal > 15 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                    <span className="text-xs text-slate-500">
                      Showing {(inboxPage - 1) * 15 + 1} - {Math.min(inboxPage * 15, inboxTotal)} of {inboxTotal}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                        disabled={inboxPage === 1}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setInboxPage((p) => (p * 15 < inboxTotal ? p + 1 : p))}
                        disabled={inboxPage * 15 >= inboxTotal}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BROADCAST PANEL */}
        {activeTab === "broadcast" && canBroadcast && (
          <div className="p-6 max-w-4xl">
            <form onSubmit={handleSendBroadcast} className="space-y-6">
              
              {/* Messages alerts */}
              {broadcastError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start space-x-3 text-xs">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{broadcastError}</span>
                </div>
              )}
              {broadcastSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start space-x-3 text-xs">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{broadcastSuccess}</span>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Form Fields */}
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Broadcast Settings</h3>
                  
                  {/* Audience Selection */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold">Target Audience</label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-primary-500 focus:outline-none transition-colors"
                    >
                      <option value="all_parents">All Active Parents/Guardians</option>
                      <option value="class">Specific Class Stream</option>
                      <option value="staff">All Staff Members</option>
                    </select>
                  </div>

                  {/* Class selection if audience is 'class' */}
                  {audience === "class" && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 font-semibold">Target Class Stream</label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-primary-500 focus:outline-none transition-colors"
                        required
                      >
                        <option value="">Select a Class Stream...</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Channels Selection */}
                  <div className="space-y-2.5">
                    <label className="text-xs text-slate-400 font-semibold block">Broadcast Channels</label>
                    <div className="grid grid-cols-3 gap-2">
                      
                      {/* In App */}
                      <button
                        type="button"
                        onClick={() => setChannels((c) => ({ ...c, in_app: !c.in_app }))}
                        className={`flex items-center justify-center space-x-2 py-3 px-2 border rounded-xl cursor-pointer text-[11px] font-bold transition-all ${
                          channels.in_app
                            ? "bg-primary-500/10 border-primary-500 text-primary-400"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <Inbox className="h-3.5 w-3.5" />
                        <span>In-App Bell</span>
                      </button>

                      {/* SMS */}
                      <button
                        type="button"
                        disabled={!isOnline}
                        onClick={() => setChannels((c) => ({ ...c, sms: !c.sms }))}
                        className={`flex items-center justify-center space-x-2 py-3 px-2 border rounded-xl cursor-pointer text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          channels.sms && isOnline
                            ? "bg-primary-500/10 border-primary-500 text-primary-400"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                        title={!isOnline ? "SMS broadcasting requires an active connection" : "Broadcast via SMS"}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>SMS Portal</span>
                      </button>

                      {/* WhatsApp */}
                      <button
                        type="button"
                        disabled={!isOnline}
                        onClick={() => setChannels((c) => ({ ...c, whatsapp: !c.whatsapp }))}
                        className={`flex items-center justify-center space-x-2 py-3 px-2 border rounded-xl cursor-pointer text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          channels.whatsapp && isOnline
                            ? "bg-primary-500/10 border-primary-500 text-primary-400"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                        title={!isOnline ? "WhatsApp broadcasting requires an active connection" : "Broadcast via WhatsApp"}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                      </button>

                    </div>
                  </div>

                  {/* Title (for in-app announcement) */}
                  {channels.in_app && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 font-semibold">In-App Announcement Title</label>
                      <input
                        type="text"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="e.g. PTA Meeting Notice"
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-primary-500 focus:outline-none transition-colors"
                      />
                    </div>
                  )}

                </div>

                {/* Message & Character Indicator */}
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Message Details</h3>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold block">Message Content</label>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Write your announcement content here..."
                      rows={6}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-sm text-slate-300 focus:border-primary-500 focus:outline-none transition-colors resize-none"
                    ></textarea>
                    
                    {/* Character Limits & SMS counts */}
                    {channels.sms && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
                        <span>Characters: {smsCharacterCount}</span>
                        <span className={smsCharacterCount > 160 ? "text-amber-400 font-bold" : ""}>
                          {smsSegments} SMS part{smsSegments > 1 ? "s" : ""} ({160 * smsSegments - smsCharacterCount} left)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Message Preview */}
                  <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">SMS / Chat Preview</span>
                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-300 break-words leading-relaxed select-none">
                      {broadcastMessage.trim() || <span className="text-slate-600 italic">No message drafted.</span>}
                      {broadcastMessage.trim() && " - Gradia Klasso"}
                    </div>
                  </div>
                </div>

              </div>

              {/* Submit Section */}
              <div className="flex justify-end pt-4 border-t border-slate-800/80">
                <button
                  type="submit"
                  disabled={broadcastLoading || (!isOnline && (channels.sms || channels.whatsapp))}
                  className="bg-primary-500 hover:bg-primary-400 disabled:opacity-40 px-6 py-3 rounded-xl text-sm font-extrabold text-white transition-all shadow-md shadow-primary-500/10 flex items-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                  title={!isOnline && (channels.sms || channels.whatsapp) ? "Cannot transmit SMS/WhatsApp broadcasts while offline" : "Transmit Broadcast"}
                >
                  {broadcastLoading ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      <span>Dispatching Announcement...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4.5 w-4.5" />
                      <span>Transmit Broadcast</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* TAB 3: LOGS PANEL */}
        {activeTab === "logs" && canViewLogs && (
          <div className="p-6 space-y-6">
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-950/20 border border-slate-850 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 font-bold">Filter By:</span>
              
              {/* Channel */}
              <select
                value={logsFilterChannel}
                onChange={(e) => {
                  setLogsFilterChannel(e.target.value);
                  setLogsPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Channels</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="in_app">In-App</option>
              </select>

              {/* Status */}
              <select
                value={logsFilterStatus}
                onChange={(e) => {
                  setLogsFilterStatus(e.target.value);
                  setLogsPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Logs Table */}
            {logsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
                <p className="text-xs text-slate-500 font-mono">Loading transmission logs...</p>
              </div>
            ) : deliveryLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm font-semibold">No delivery logs matched filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-800/80 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider select-none">
                        <th className="p-4">Recipient</th>
                        <th className="p-4">Channel</th>
                        <th className="p-4 w-1/3">Message</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Dispatched At</th>
                        <th className="p-4">Error details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 bg-slate-950/10">
                      {deliveryLogs.map((log) => {
                        return (
                          <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="p-4 font-mono text-slate-300">
                              {log.recipientPhone || "System / In-App"}
                            </td>
                            <td className="p-4">
                              <span className="capitalize font-semibold">{log.channel}</span>
                            </td>
                            <td className="p-4 max-w-xs truncate text-slate-400" title={log.message}>
                              {log.message}
                            </td>
                            <td className="p-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  log.status === "sent"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : log.status === "failed"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500 font-mono">
                              {log.sentAt
                                ? new Date(log.sentAt).toLocaleString()
                                : new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="p-4 text-red-400 max-w-xs truncate" title={log.error || ""}>
                              {log.error || <span className="text-slate-600 font-mono">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsTotal > 20 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                    <span className="text-xs text-slate-500">
                      Showing {(logsPage - 1) * 20 + 1} - {Math.min(logsPage * 20, logsTotal)} of {logsTotal}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                        disabled={logsPage === 1}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setLogsPage((p) => (p * 20 < logsTotal ? p + 1 : p))}
                        disabled={logsPage * 20 >= logsTotal}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
export default NotificationsPage;
