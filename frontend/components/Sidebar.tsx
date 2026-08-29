"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/",          label: "Dashboard",      icon: "📊" },
  { href: "/orders",    label: "Orders",          icon: "📦" },
  { href: "/riders",    label: "Riders & VCs",    icon: "🛵" },
  { href: "/simulate",  label: "Rider Simulator", icon: "⚡" },
  { href: "/audit",     label: "Audit Ledger",    icon: "📜" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">SG</div>
        <div>
          <div className="logo-name">SafeGate</div>
          <div className="logo-tag">Auth Console</div>
        </div>
      </div>

      {/* Nav */}
      <p className="sidebar-section-label">Navigation</p>
      <ul className="sidebar-nav">
        {navItems.map(item => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className={isActive ? "active" : ""}>
              <Link href={item.href}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Divider + info */}
      <div style={{ margin: "20px 0 8px", padding: "0 12px" }}>
        <div style={{ height: 1, background: "var(--border)" }} />
      </div>
      <p className="sidebar-section-label">System</p>
      <div style={{ padding: "0 12px" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
          W3C DID/VC<br />
          Ed25519 Signatures<br />
          Deterministic Guardian
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="node-status">
          <span className="dot" />
          <span>Guardian node active</span>
        </div>
      </div>
    </aside>
  );
}
