"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck } from "lucide-react";

export function ProtectedRoute({
  children,
  requireVerified = false,
}: {
  children: React.ReactNode;
  requireVerified?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isVerified, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Automatically redirect to login and preserve target path
        const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
        router.replace(redirectUrl);
      } else if (requireVerified && !isVerified) {
        router.replace("/verify-email");
      }
    }
  }, [isLoading, isAuthenticated, isVerified, requireVerified, router, pathname]);

  if (isLoading || !isAuthenticated || (requireVerified && !isVerified)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 mx-auto mb-4 animate-pulse">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span>Verifying security credentials...</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Redirecting to secure login...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
