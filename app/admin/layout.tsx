import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdminUser } from "@/app/admin-auth";
import AdminNav from "./admin-nav";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s | Thevenin Operations" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdminUser("/admin");

  return (
    <div className="admin-app">
      <AdminNav user={user} />
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div><span className="admin-status-dot" /> Internal operations</div>
          <Link href="/" target="_blank">View storefront <ExternalLink size={14} /></Link>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

