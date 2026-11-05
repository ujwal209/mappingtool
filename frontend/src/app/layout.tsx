import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { MappingProvider } from "@/context/MappingContext";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Data Migration & Ontology Studio",
  description:
    "Enterprise data migration platform with semantic ontology modeling, automated field mapping, and audit reconciliation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 font-sans selection:bg-slate-200 selection:text-slate-900">
        <AuthProvider>
          <ProjectProvider>
            <MappingProvider>
              <Toaster position="bottom-right" richColors closeButton />
              {children}
            </MappingProvider>
          </ProjectProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
