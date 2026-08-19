import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { CartIndicator } from "./cart-indicator";

type HeaderSection = "store" | "marketplace" | "viewer" | "lab";

export function SiteHeader({ active }: { active?: HeaderSection }) {
  return (
    <header className="commerce-header">
      <div className="utility-bar">
        <div className="shell utility-inner">
          <nav aria-label="Customer service"><Link href="/contact?type=support">Contact &amp; support</Link><Link href="/account#orders">Order status</Link><Link href="/contact?type=quote">Request a quote</Link><Link href="/docs">Resources</Link></nav>
          <span>Specialist sourcing for engineering teams</span>
        </div>
      </div>
      <div className="shell masthead">
        <Link className="wordmark" href="/" aria-label="Thevenin home"><span className="wordmark-symbol">V<sub>TH</sub></span><span><b>THEVENIN</b><small>ELECTRONICS SUPPLY</small></span></Link>
        <form className="header-search" action="/store" role="search">
          <label className="sr-only" htmlFor="site-search">Search products</label>
          <input id="site-search" name="q" placeholder="Search by keyword or part number" />
          <button type="submit" aria-label="Search"><Search size={19} /></button>
        </form>
        <div className="masthead-actions">
          <Link href="/account"><UserRound size={20} /><span><small>Sign in</small><b>My account</b></span></Link>
          <CartIndicator />
        </div>
      </div>
      <div className="category-nav">
        <nav className="shell" aria-label="Product navigation">
          <Link className={active === "store" ? "active" : ""} href="/store"><b>Shop products</b></Link>
          <Link href="/contact?type=quote">Request a quote</Link>
          <Link href="/contact?type=sourcing">Specialist sourcing</Link>
          <Link href="/account#orders">Order status</Link>
          <Link href="/contact?type=support">Contact support</Link>
          <Link className={(active === "marketplace" || active === "viewer" || active === "lab") ? "active works-link" : "works-link"} href="/marketplace">Thevenin Works</Link>
        </nav>
      </div>
    </header>
  );
}

export function DivisionBanner() {
  return (
    <div className="division-banner">
      <div className="shell">
        <Link className="division-name" href="/marketplace"><span className="division-mark">TW</span><span><b>THEVENIN WORKS</b><small>Design marketplace &amp; verification</small></span></Link>
        <nav aria-label="Thevenin Works"><Link href="/marketplace">Designs</Link><Link href="/viewer">Gerber workbench</Link><Link href="/lab">Lab verification</Link><Link href="/sell">Publish</Link></nav>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-help">
        <div><b>Need help selecting equipment?</b><span>Send the application, operating range, and required delivery date.</span></div>
        <Link href="/contact?type=support">Contact an applications specialist <span>→</span></Link>
      </div>
      <div className="shell footer-grid">
        <div><Link className="wordmark footer-wordmark" href="/"><span className="wordmark-symbol">V<sub>TH</sub></span><span><b>THEVENIN</b><small>ELECTRONICS SUPPLY</small></span></Link><p>One practical source for specialized electronics, test equipment, engineering designs, and verification.</p></div>
        <div><b>Shop</b><Link href="/store">All products</Link><Link href="/contact?type=sourcing">Specialist sourcing</Link><Link href="/contact?type=quote">Request a quote</Link><Link href="/account#orders">Order status</Link></div>
        <div><b>Thevenin Works</b><Link href="/marketplace">Design marketplace</Link><Link href="/viewer">Gerber workbench</Link><Link href="/lab">Paid lab verification</Link><Link href="/sell">Publish a design</Link></div>
        <div><b>Information</b><Link href="/docs">Trust &amp; policies</Link><Link href="/docs#storage">File privacy</Link><Link href="/contact?type=support">Support</Link><Link href="https://github.com/OpenPCBs/web">GitHub</Link></div>
      </div>
      <div className="shell footer-legal"><span>© 2026 Thevenin</span><span>Products are listed only after they are reviewed and published.</span></div>
    </footer>
  );
}
