"use client";

import Link from "../components/native-link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardCheck,
  Gauge,
  Inbox,
  Settings,
  ShoppingBag,
  UsersRound,
} from "lucide-react";

const links = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/products", label: "Products", icon: Boxes, exact: false },
  { href: "/admin/users", label: "Users", icon: UsersRound, exact: false },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, exact: false },
  { href: "/admin/verifications", label: "Verification", icon: ClipboardCheck, exact: false },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

type AdminIdentity = {
  email: string;
  displayName: string;
  role: string;
};

export default function AdminNav({ user }: { user: AdminIdentity }) {
  const pathname = usePathname();
  const visibleLinks = user.role === "admin"
    ? links
    : links.filter(({ href }) => href !== "/admin/users" && href !== "/admin/settings");

  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin" aria-label="Thevenin administration home">
        <span className="admin-brand-mark">V<sub>TH</sub></span>
        <span><b>THEVENIN</b><small>OPERATIONS</small></span>
      </Link>

      <nav className="admin-nav" aria-label="Administration">
        {visibleLinks.map(({ href, label, icon: Icon, ...item }) => {
          const active = item.exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} data-active={active || undefined} aria-current={active ? "page" : undefined}>
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-foot">
        <span className="admin-avatar" aria-hidden="true">{initials(user.displayName || user.email)}</span>
        <span><b>{user.displayName || "Administrator"}</b><small>{user.role} · {user.email}</small></span>
      </div>
    </aside>
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : value.slice(0, 2)).toUpperCase();
}
