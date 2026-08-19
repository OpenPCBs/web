import type { Metadata } from "next";
import GerberWorkbench from "../components/gerber-workbench";
import { DivisionBanner, SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = {
  title: "Gerber Workbench | Thevenin Works",
  description: "Inspect Gerber and Excellon fabrication packages locally, then cross-check them with Ucamco Reference CAM.",
};

export default function ViewerPage() {
  return (
    <>
      <SiteHeader active="works" />
      <DivisionBanner />
      <main className="gerber-page">
        <section className="gerber-page-intro shell">
          <div>
            <span className="kicker">THEVENIN WORKS · LOCAL-FIRST INSPECTION</span>
            <h1>See the board the fab will see.</h1>
            <p>Open a fabrication ZIP or individual Gerber and Excellon layers. Inspect the complete stack locally, then use Ucamco Reference CAM for an authoritative second pass.</p>
          </div>
          <div className="gerber-intro-facts" aria-label="Workbench capabilities">
            <span><b>Private</b><small>Local SVG rendering</small></span>
            <span><b>Layered</b><small>Top, bottom, drill &amp; outline</small></span>
            <span><b>Reference</b><small>Official Ucamco CAM mode</small></span>
          </div>
        </section>
        <div className="gerber-workbench-shell">
          <GerberWorkbench />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
