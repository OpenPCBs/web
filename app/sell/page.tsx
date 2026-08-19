import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import styles from "@/app/components/design-works.module.css";
import { SellForm } from "@/app/components/sell-form";
import { DivisionBanner, SiteFooter, SiteHeader } from "@/app/components/site-shell";

export const metadata: Metadata = {
  title: "Design Creator Workspace",
  description: "Create, edit, publish, archive, and attach revision files to a database-backed Thevenin Works design.",
};

export const dynamic = "force-dynamic";

type SellSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, maxLength = 100): string {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, maxLength) ?? "";
}

export default async function SellPage({ searchParams }: { searchParams: SellSearchParams }) {
  const [params, user] = await Promise.all([searchParams, getChatGPTUser()]);
  const designId = first(params.designId);
  const returnTo = designId ? `/sell?designId=${encodeURIComponent(designId)}` : "/sell";

  return (
    <>
      <SiteHeader active="marketplace" />
      <DivisionBanner />
      <main className={styles.page}>
        <div className={styles.container}>
          <section className={styles.sellHero}>
            <span className={styles.kicker}>THEVENIN WORKS · CREATOR WORKSPACE</span>
            <h1>{designId ? "Edit your design record" : "Create a private design draft"}</h1>
            <p>
              Design fields, publication state, revision IDs, and uploaded files are persisted.
              Nothing appears in the public marketplace until you explicitly publish it.
            </p>
          </section>
          <div className={styles.sellLayout}>
            <aside className={styles.checklist}>
              <span>REAL RELEASE FLOW</span>
              <ol>
                <li><b>Save the record</b><p>Create a private design and its initial revision.</p></li>
                <li><b>Attach files</b><p>Uploads are stored against the current revision and begin private.</p></li>
                <li><b>Publish explicitly</b><p>Publication updates the design and current revision lifecycle.</p></li>
                <li><b>Choose file visibility</b><p>Only files you mark public are downloadable by marketplace visitors.</p></li>
              </ol>
              <p className={styles.checklistNote}>Paid verification can start only after the API returns a real current revision ID.</p>
            </aside>
            <SellForm
              initialDesignId={designId}
              signedIn={Boolean(user)}
              signInHref={chatGPTSignInPath(returnTo)}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
