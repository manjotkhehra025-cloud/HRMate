import type { Metadata, Viewport } from "next";
import "./globals.css";
import PrefsProvider from "@/components/PrefsProvider";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "HRMate — Smart HRMS",
  description: "Attendance, leaves, social wall, GPS punch-in and more — one premium HR platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HRMate",
  },
  icons: { apple: "/icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1E6FE0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const PREFS_BOOT = `(function(){try{var t=localStorage.getItem("hrmate_appearance")||"system";var s=localStorage.getItem("hrmate_text_size")||"medium";var l=localStorage.getItem("hrmate_language")||"en";var theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.setAttribute("data-theme",theme);document.documentElement.setAttribute("data-text",s);document.documentElement.lang=l==="pa"?"pa":"en";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
