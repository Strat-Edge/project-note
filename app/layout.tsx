import type { Metadata, Viewport } from "next";
import { Header } from "@/components/header";
import { Switcher } from "@/components/switcher";
import { CaptureFlow } from "./capture-flow";
import { iosSplashStartupImages } from "@/components/ios-splash-startup-images";
import { StorageInit } from "./storage-init";
import { SyncEngine } from "./sync-engine";
import { SyncIndicator } from "./sync-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strat'Edge",
  description: "Application de gestion de projets personnelle — Strat'Edge",
  applicationName: "Strat'Edge",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Strat'Edge",
    startupImage: iosSplashStartupImages,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2A44",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        <StorageInit />
        <Header />
        <SyncEngine />
        <SyncIndicator />
        <Switcher />
        {children}
        <CaptureFlow />
      </body>
    </html>
  );
}
