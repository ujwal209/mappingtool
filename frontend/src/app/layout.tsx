import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { MappingProvider } from "@/context/MappingContext";
import { Toaster } from "sonner";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={`h-full antialiased ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="h-full bg-slate-50 text-slate-900 font-sans selection:bg-slate-200 selection:text-slate-900"
        suppressHydrationWarning
      >
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
