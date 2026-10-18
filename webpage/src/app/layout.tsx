import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { OrganizationStructuredData, WebSiteStructuredData, SiteNavigationStructuredData } from '@/components/StructuredData';
import Analytics from '@/components/Analytics';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-ds-display",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ds-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://theasolutions.co") || "http://localhost:3000",
  title: "Thea Solutions | Bespoke Software & Enterprise AI Solutions",
  description: "Thea Solutions specializes in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.",
  keywords: ["bespoke software development", "enterprise AI", "automation solutions", "SME technology", "business automation", "custom software", "AI integration"],
  authors: [{ name: "Thea Solutions" }],
  creator: "Thea Solutions",
  publisher: "Thea Solutions",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://theasolutions.co",
    title: "Thea Solutions | Bespoke Software Development & AI Solutions for SMEs",
    description: "Thea Solutions specializes in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.",
    siteName: "Thea Solutions",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Thea Solutions Brand Icon",
      },
      {
        url: "/dark_tranStacked_logo.png",
        width: 1200,
        height: 630,
        alt: "Thea Solutions Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thea Solutions | Bespoke Software Development & AI Solutions for SMEs",
    description: "Thea Solutions specializes in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.",
    images: ["/dark_tranStacked_logo.png"],
  },
  verification: {
    google: "xD5KF2iUPieQIWeYovvceRmKSydkyTYxiYECUUVTpaM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`antialiased bg-color paragraph-color ${bricolageGrotesque.variable} ${ibmPlexMono.variable} ${inter.variable}`} >
        <OrganizationStructuredData />
        <WebSiteStructuredData />
        <SiteNavigationStructuredData />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
