"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Live Dashboard", href: "/", icon: "📊" },
    { name: "Orders Registry", href: "/orders", icon: "📦" },
    { name: "Riders Registry", href: "/riders", icon: "🛵" },
    { name: "Audit Ledger", href: "/audit", icon: "📜" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">SG</div>
        <span className="logo-text">SafeGate</span>
      </div>

      <nav>
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li
                key={item.href}
                className={`menu-item ${isActive ? "active" : ""}`}
              >
                <Link href={item.href}>
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
