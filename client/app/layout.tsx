import type { Metadata } from "next";
import { SideNav } from "@/components/SideNav";
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
      <body>
        <div className="app-frame">
          <SideNav />
          <div className="app-shell">
            <div className="app-bg" />
            <div className="app-grid">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
