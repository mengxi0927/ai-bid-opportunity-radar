import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "招投标商机智能雷达",
  description: "AI 驱动的招投标商机发现与推荐 POC"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
