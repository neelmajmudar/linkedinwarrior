import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedInWarrior — AI-Powered LinkedIn Content Engine",
  description: "Generate LinkedIn posts in your authentic voice using AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased bg-mesh">{children}</body>
    </html>
  );
}
