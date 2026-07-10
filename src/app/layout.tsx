import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// 中文字体：@fontsource 自托管（构建后随应用同源部署，国内走 Vercel CDN，不受 Google 封锁影响）
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-serif-sc/400.css";
import "@fontsource/noto-serif-sc/600.css";
import "@fontsource/noto-serif-sc/700.css";
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
  title: "公文 OS",
  description: "基于 AI 的智能公文写作与管理平台",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var THEME_KEY = 'gw-theme-mode';
                var mode = 'auto';
                try { var s = localStorage.getItem(THEME_KEY); if (s === 'light' || s === 'dark' || s === 'auto') mode = s; } catch(e) {}
                function apply(m) {
                  var isDark = m === 'dark' || (m === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.classList.toggle('dark', isDark);
                }
                apply(mode);
                if (mode === 'auto') {
                  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() { apply('auto'); });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
