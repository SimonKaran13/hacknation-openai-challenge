"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="side-nav">
      <div className="side-brand">
        <div className="side-logo">COS</div>
        <div>
          <p className="side-eyebrow">AI Chief of Staff</p>
          <p className="side-title">Command Center</p>
        </div>
      </div>
      <nav className="nav-links">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-link ${isActive ? "active" : ""}`}>
              <span className="nav-icon">
                <Icon size={16} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="side-footer">
        <p>Live API surfaces for tasks, boards, and org graphs.</p>
      </div>
    </aside>
  );
}
