import type { Metadata, Viewport } from "next";

import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI工事・リフォーム見積管理システム",
    template: "%s | AI工事・リフォーム見積管理システム",
  },
  description:
    "工事会社・工務店・リフォーム会社向けの見積作成、原価・粗利管理、AI見積チェック、PDF見積書発行を行う業務システムです。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101a28",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
