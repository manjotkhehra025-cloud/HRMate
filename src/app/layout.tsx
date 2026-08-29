import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRMate — Smart HRMS",
  description: "Attendance, leaves, social wall, GPS punch-in and more — one premium HR platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1E6FE0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
