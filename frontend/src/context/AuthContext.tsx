import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "../services/api";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "headteacher" | "class_teacher" | "bursar" | "parent" | "student";
}

interface School {
  id: string;
  name: string;
  subdomain: string;
}

interface AuthContextType {
  user: User | null;
  school: School | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, schoolLocator: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setSchool: React.Dispatch<React.SetStateAction<School | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitor token expiration trigger from axios interceptor
  useEffect(() => {
    const handleAutoLogout = () => {
      logout();
    };

    window.addEventListener("auth_logout", handleAutoLogout);
    return () => {
      window.removeEventListener("auth_logout", handleAutoLogout);
    };
  }, []);

  useEffect(() => {
    // Hydrate auth state from localStorage
    const savedToken = localStorage.getItem("gradia_token");
    const savedUser = localStorage.getItem("gradia_user");
    const savedSchool = localStorage.getItem("gradia_school");

    if (savedToken && savedUser && savedSchool) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setSchool(JSON.parse(savedSchool));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, schoolLocator: string) => {
    const res = await apiRequest<{ accessToken: string; refreshToken: string; user: User; school: School }>(
      "/auth/login",
      {
        method: "POST",
        body: { email, password, schoolLocator },
      }
    );

    if (res.success && res.data) {
      const { accessToken, refreshToken, user, school } = res.data;
      localStorage.setItem("gradia_token", accessToken);
      localStorage.setItem("gradia_refresh_token", refreshToken);
      localStorage.setItem("gradia_user", JSON.stringify(user));
      localStorage.setItem("gradia_school", JSON.stringify(school));
      setToken(accessToken);
      setUser(user);
      setSchool(school);
      return { success: true };
    }

    return { success: false, error: res.error || "Login failed" };
  };

  const logout = () => {
    const refreshToken = localStorage.getItem("gradia_refresh_token");
    if (refreshToken) {
      // Fire-and-forget logout request to backend (ignores errors if token already invalidated)
      apiRequest("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      }).catch((e) => console.log("Logout backend invalidation warning:", e));
    }

    localStorage.removeItem("gradia_token");
    localStorage.removeItem("gradia_refresh_token");
    localStorage.removeItem("gradia_user");
    localStorage.removeItem("gradia_school");
    setToken(null);
    setUser(null);
    setSchool(null);
  };

  return (
    <AuthContext.Provider value={{ user, school, token, loading, login, logout, setUser, setSchool }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
