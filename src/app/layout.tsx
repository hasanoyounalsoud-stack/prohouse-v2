import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "برو هاوس اوبريشن | Pro House Operations",
  description: "نظام إدارة عمليات وسلاسل إمداد مطاعم برو هاوس",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/icon-192.png",
    apple: "/assets/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7DC4E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="h-full flex flex-col antialiased bg-slate-50 text-slate-900 select-none">
        {children}
      </body>
    </html>
  );
}
