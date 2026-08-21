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
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "FILMPICK — 한 장의 세계를 발견하다",
  description: "태그와 장소로 전 세계 Flickr 사진을 발견하고 나만의 앨범에 간직하세요.",
  openGraph: {
    title: "FILMPICK — 한 장의 세계를 발견하다",
    description: "태그와 장소로 전 세계 사진가의 시선을 발견하고 간직하세요.",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "FILMPICK 소셜 미리보기" }],
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "FILMPICK — 한 장의 세계를 발견하다",
    description: "태그와 장소로 전 세계 사진가의 시선을 발견하고 간직하세요.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
