"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api, UserProfile } from "@/lib/api-client";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  tenantId: string;
  setTenantId: (tenant: string) => void;
  isAuthenticated: boolean;
  isVerified: boolean;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  signup: (data: {
    email: string;
    password: string;
    full_name: string;
    organization?: string;
    role?: string;
  }) => Promise<string>;
  verifyEmail: (token: string, email?: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, new_password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantIdState] = useState<string>("tenant-default");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setTenantId = (t: string) => {
    setTenantIdState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("tenant_id", t);
    }
  };

  const refreshUser = async () => {
    try {
      const profile = await api.getMe();
      setUser(profile);
      if (profile.tenant_id) {
        setTenantIdState(profile.tenant_id);
        if (typeof window !== "undefined") {
          localStorage.setItem("tenant_id", profile.tenant_id);
        }
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedToken = localStorage.getItem("auth_token");
    const savedTenant = localStorage.getItem("tenant_id") || "tenant-default";
    setTenantIdState(savedTenant);

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    setToken(savedToken);
    api
      .getMe()
      .then((profile) => {
        setUser(profile);
        if (profile.tenant_id) {
          setTenantIdState(profile.tenant_id);
          localStorage.setItem("tenant_id", profile.tenant_id);
        }
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (data: { email: string; password: string }) => {
    const res = await api.login(data);

    // ⬇️ THE CRITICAL FIX: persist the token so refreshUser + reload work
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", res.access_token);
      if (res.tenant_id) {
        localStorage.setItem("tenant_id", res.tenant_id);
      }
    }

    setToken(res.access_token);
    if (res.tenant_id) setTenantIdState(res.tenant_id);

    // Make sure api-client uses the new token before we call /me
    await refreshUser();
  };

  const signup = async (data: {
    email: string;
    password: string;
    full_name: string;
    organization?: string;
    role?: string;
  }) => {
    const res = await api.signup(data);
    return res.verification_token || "";
  };

  const verifyEmail = async (verificationToken: string, email?: string) => {
    await api.verifyEmail(verificationToken, email);
    if (token) {
      await refreshUser();
    }
  };

  const resendVerification = async (email: string) => {
    await api.resendVerification(email);
  };

  const forgotPassword = async (email: string) => {
    const res = await api.forgotPassword(email);
    return res.reset_token || "";
  };

  const resetPassword = async (resetToken: string, new_password: string) => {
    await api.resetPassword(resetToken, new_password);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      // keep tenant_id if you like, otherwise remove too
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        tenantId,
        setTenantId,
        isAuthenticated: !!token && !!user,
        isVerified: !!user?.is_verified,
        isLoading,
        login,
        signup,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}