import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Schedule Demo | Thea Solutions",
  description: "Schedule a personalized demo of Thea Solutions AI-powered enterprise products.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function ScheduleDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-color paragraph-color">
      {children}
    </div>
  );
}