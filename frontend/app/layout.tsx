import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code for Resilience | Balangiga Command Center",
  description: "Verified alerts, evacuation capacity, and SOS triage for Balangiga.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-appearance="dark">
      <body>{children}</body>
    </html>
  );
}
