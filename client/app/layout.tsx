import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Chief of Staff - MVP Demo",
  description: "Organizational Intelligence UI MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
