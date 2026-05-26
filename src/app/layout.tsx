import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfficeHub — Projects & Status",
  description:
    "Self-hosted office workspace: track projects, timelines, enhancements, and roll up status for managers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-black">{children}</body>
    </html>
  );
}
