import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "庫存後台",
  description: "eSIM stock and shipping",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "庫存後台",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <script
          src="https://painpoint-hub-production.up.railway.app/feedback-plugin.js?v=4"
          data-api="https://painpoint-hub-production.up.railway.app"
          defer
        ></script>
      </body>
    </html>
  );
}
