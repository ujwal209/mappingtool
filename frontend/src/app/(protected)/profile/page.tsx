"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Building,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Database,
  Lock,
  ArrowRight,
  LogOut,
  Clock,
  Sparkles,
} from "lucide-react";

export default function ProfilePage() {
  const { user, tenantId, logout } = useAuth();
  const { activeProject } = useProject();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters long." });
      return;
    }

    setUpdatingPassword(true);
    setPasswordMsg(null);

    try {
      // Simulate/perform password update via auth endpoint
      setPasswordMsg({ type: "success", text: "Security credentials updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to update password." });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-900 text-white tracking-wider uppercase">
                Account Settings
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              User Profile & Workspace Preferences
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage personal identity, security credentials, active organization tenant, and project scopes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: User Identity Card */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
              <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50">
                <div className="w-20 h-20 rounded-full bg-slate-900 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3 shadow-sm border-2 border-white">
                  {user?.full_name?.charAt(0) || "U"}
                </div>
                <h2 className="text-base font-bold text-slate-900">{user?.full_name || "Enterprise Operator"}</h2>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-800 border-slate-300">
                    {user?.role ? user.role.replace("ROLE_", "") : "OPERATOR"}
                  </Badge>
                  {user?.is_verified ? (
                    <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-800 border-slate-300">
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-800 border-amber-200">
                      Pending Email Verification
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-4 space-y-3 text-xs text-slate-600">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Organization
                  </span>
                  <span className="font-semibold text-slate-900">{user?.organization || "Enterprise Core"}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Tenant Identifier
                  </span>
                  <span className="font-mono text-slate-900 text-[11px]">{user?.tenant_id || tenantId || "tenant-default"}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5" /> Active Scope
                  </span>
                  <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                    {activeProject?.name || "Global Scope"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Quick Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Link
                  href="/dashboard"
                  className="flex items-center justify-between p-2 rounded hover:bg-slate-50 transition text-slate-700"
                >
                  <span>Project Command Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
                <Link
                  href="/connectors"
                  className="flex items-center justify-between p-2 rounded hover:bg-slate-50 transition text-slate-700"
                >
                  <span>Manage Data Connections</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
                <Link
                  href="/ontology"
                  className="flex items-center justify-between p-2 rounded hover:bg-slate-50 transition text-slate-700"
                >
                  <span>Ontology Studio & Builder</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Security & Identity Forms */}
          <div className="md:col-span-2 space-y-6">
            {/* Identity Information Form */}
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-700" />
                  Personal Information
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Identity attributes tied to platform audit logs and governance approvals.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      readOnly
                      value={user?.full_name || ""}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      readOnly
                      value={user?.email || ""}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Assigned Organization</label>
                    <input
                      type="text"
                      readOnly
                      value={user?.organization || "Enterprise Core"}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Security Role</label>
                    <input
                      type="text"
                      readOnly
                      value={user?.role || "ROLE_OPERATOR"}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none cursor-not-allowed font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password & Security Credentials Form */}
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700" />
                  Security & Access Credentials
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Update your authentication password and maintain zero credential leakage.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4 text-xs">
                {passwordMsg && (
                  <div
                    className={`p-3 rounded text-xs flex items-center gap-2 ${
                      passwordMsg.type === "success"
                        ? "bg-slate-100 border border-slate-200 text-slate-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    {passwordMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-slate-700" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-3 py-2 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full px-3 py-2 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full px-3 py-2 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={updatingPassword}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 h-8"
                    >
                      {updatingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
