import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Metrics Viewer",
  description: "Claude Code adoption and Claude API usage & cost for your Anthropic organization",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
