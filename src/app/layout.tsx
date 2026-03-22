import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "antd/dist/reset.css";

import { Providers } from "@/app/providers";
import { APP_NAME } from "@/shared/constants/app";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "法律刷题与后台管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={notoSans.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
