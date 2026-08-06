import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StorageInit } from "./storage-init";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Note",
  description: "Application de gestion de projets personnelle — Strat'Edge",
  applicationName: "Project Note",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Project Note",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2A44",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <StorageInit />
        {children}
      </body>
    </html>
  );
}
