import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "flickercast - 経済的自立シミュレーター",
  description: "FIREに向けた資産運用と支出管理をシミュレートするWebアプリケーション",
  keywords: ["FIRE", "経済的自立", "早期退職", "資産運用", "シミュレーション"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} font-sans antialiased bg-gray-50 min-h-screen`}
      >
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
