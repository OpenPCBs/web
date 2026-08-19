import type { Metadata } from "next";
import { DesignMarketplace } from "@/app/components/design-marketplace";
import styles from "@/app/components/design-works.module.css";
import { DivisionBanner, SiteFooter, SiteHeader } from "@/app/components/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Published Engineering Designs | Thevenin Works" },
  description: "Browse real, owner-published electronics designs and their persisted revision records.",
};

export const dynamic = "force-dynamic";

type SearchValue = string | string[] | undefined;
type MarketplaceSearchParams = Promise<Record<string, SearchValue>>;

function first(value: SearchValue, maxLength = 160): string {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, maxLength) ?? "";
}

export default async function MarketplacePage({ searchParams }: { searchParams: MarketplaceSearchParams }) {
  const params = await searchParams;
  const sort = first(params.sort, 20);
  return (
    <>
      <SiteHeader active="marketplace" />
      <DivisionBanner />
      <main className={styles.page}>
        <div className={styles.container}>
          <DesignMarketplace
            initialQuery={first(params.q)}
            initialCategory={first(params.category, 80)}
            initialVerification={first(params.verification, 30)}
            initialSort={["newest", "price-low", "price-high"].includes(sort) ? sort : "newest"}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
