import type { Metadata } from "next";
import { DesignDetailClient } from "@/app/components/design-detail-client";
import styles from "@/app/components/design-works.module.css";
import { DivisionBanner, SiteFooter, SiteHeader } from "@/app/components/site-shell";

type RouteParams = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: "Design Record | Thevenin Works" },
    description: "View a persisted Thevenin Works design, its current revision, uploaded files, and recorded verification status.",
  };
}

export default async function DesignDetailPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  return (
    <>
      <SiteHeader active="works" />
      <DivisionBanner />
      <main className={styles.page}>
        <div className={styles.container}>
          <DesignDetailClient slug={slug} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
