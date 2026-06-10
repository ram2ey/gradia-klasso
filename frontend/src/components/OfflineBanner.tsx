import React, { useState, useEffect } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 px-4 py-2.5 flex items-center justify-center space-x-2.5 font-sans shadow-md sticky top-0 z-50 text-xs sm:text-sm animate-pulse no-print">
      <WifiOff className="h-4.5 w-4.5 shrink-0 text-slate-950" />
      <span className="font-extrabold tracking-wide uppercase">Offline Mode Active</span>
      <span className="font-semibold text-slate-900 hidden sm:inline">|</span>
      <span className="font-medium text-slate-900">
        You are offline. Mutating actions will be queued and synchronized automatically when connection is restored.
      </span>
      <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-slate-950 animate-bounce" />
    </div>
  );
};

export default OfflineBanner;
