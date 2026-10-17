import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { OrganizationStructuredData, WebSiteStructuredData } from '@/components/StructuredData';
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
  title: "Thea Solutions",
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
    icon: "/logo.ico",
    shortcut: "/logo.ico",
    apple: "/logo.ico",
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
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
