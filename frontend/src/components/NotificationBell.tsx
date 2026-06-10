import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Loader2, Sparkles, Inbox } from "lucide-react";
import { apiRequest } from "../services/api";

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "fee_reminder" | "attendance_alert" | "result_published" | "announcement" | "general";
  isRead: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch unread count
  const fetchStats = async () => {
    const res = await apiRequest<{ unreadCount: number }>("/notifications/stats");
    if (res.success && res.data) {
      setUnreadCount(res.data.unreadCount);
    }
  };

  // Fetch latest notifications
  const fetchLatestNotifications = async () => {
    setIsLoading(true);
    const res = await apiRequest<{ notifications: Notification[] }>("/notifications?limit=10");
    if (res.success && res.data) {
      setNotifications(res.data.notifications);
    }
    setIsLoading(false);
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    const res = await apiRequest("/notifications/read-all", { method: "PUT" });
    if (res.success) {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Initial fetch and set interval for polling unread count
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // When bell is clicked, toggle open and fetch latest list
  const handleToggle = () => {
    if (!isOpen) {
      fetchLatestNotifications();
    }
    setIsOpen(!isOpen);
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "Recently";
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={`bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 p-2 rounded-xl text-slate-400 hover:text-white transition-all relative ${
          unreadCount > 0 ? "animate-pulse" : ""
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-ghana-red text-[10px] font-bold text-white shadow-md border border-slate-900 animate-bounce">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 rounded-2xl glass border border-slate-800/80 shadow-2xl z-50 overflow-hidden animate-fade-in origin-top-right">
          {/* Header */}
          <div className="p-4 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-ghana-gold" />
              <h3 className="font-bold text-sm text-white">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary-400 hover:text-primary-300 font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Mark read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/50">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
                <div className="bg-slate-800/50 p-3 rounded-full text-slate-500">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-300">All caught up!</p>
                  <p className="text-xs text-slate-500">No new notifications at the moment.</p>
                </div>
              </div>
            ) : (
              notifications.map((n) => {
                const styles = getNotificationStyles(n.type);
                return (
                  <div
                    key={n.id}
                    className={`p-4 transition-all hover:bg-slate-800/30 flex flex-col space-y-1 ${
                      !n.isRead ? "bg-slate-900/20 border-l-2 border-primary-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold tracking-wide ${styles.bg}`}>
                        {styles.label}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className={`text-xs font-semibold ${!n.isRead ? "text-white" : "text-slate-300"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <button
            onClick={() => {
              setIsOpen(false);
              navigate("/notifications");
            }}
            className="w-full text-center py-3 bg-slate-900/40 hover:bg-slate-900/70 border-t border-slate-800/80 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            View all inbox
          </button>
        </div>
      )}
    </div>
  );
};
export default NotificationBell;
