import Link from "next/link";
import { ArrowRight, Box, FileText, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { SiteFooter, SiteHeader } from "./components/site-shell";

const categories = [
  ["Oscilloscopes", "Bench, mixed-signal, high-resolution", "42"],
  ["Power supplies", "Linear, switching and regenerative", "31"],
  ["Electronic loads", "DC, AC and bidirectional", "18"],
  ["Power analyzers", "Single and multi-phase measurement", "24"],
  ["Probes & sensors", "High-voltage, current and isolated", "56"],
  ["GaN & SiC", "Devices, modules and gate drivers", "73"],
  ["Thermal & EMI", "Imaging, shielding and interfaces", "37"],
  ["Development kits", "Evaluation boards and build kits", "29"],
] as const;

const products = [
  { image: "/products/siglent-sds2000x-plus.jpg", brand: "SIGLENT", sku: "SDS2354X PLUS", name: "350 MHz 4-channel digital oscilloscope", specs: "2 GSa/s · 200 Mpts/ch · 10.1-inch touch display", price: "$2,999.00", status: "Check availability" },
  { image: "/products/siglent-sdg2042x.png", brand: "SIGLENT", sku: "SDG2042X", name: "40 MHz function/arbitrary waveform generator", specs: "2 channels · 1.2 GSa/s · 16-bit resolution", price: "$574.00", status: "Check availability" },
  { image: "/products/siglent-spd3303x-e.jpg", brand: "SIGLENT", sku: "SPD3303X-E", name: "Triple-output programmable DC power supply", specs: "2 × 32 V / 3.2 A · USB · 220 W total", price: "$459.00", status: "Check lead time" },
  { image: "/products/siglent-ssa3032x.png", brand: "SIGLENT", sku: "SSA3032X", name: "3.2 GHz spectrum analyzer with tracking generator", specs: "9 kHz–3.2 GHz · 1 Hz RBW · −161 dBm/Hz", price: "$2,595.00", status: "Check availability" },
] as const;

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="home-page">
        <section className="store-hero shell">
          <div className="store-hero-copy">
            <span className="store-kicker">SPECIALIZED ELECTRONICS DISTRIBUTION</span>
            <h1>Power electronics and test equipment, in one practical catalog.</h1>
            <p>Source instruments, wide-bandgap components, evaluation hardware, and complete build kits with application support and one accountable fulfillment contact.</p>
            <div className="store-hero-actions"><Link className="commerce-button" href="/store">Shop the catalog</Link><Link className="commerce-button secondary" href="/docs#suppliers">Request a quote</Link></div>
            <ul className="store-hero-list"><li>Purchase orders and project pricing</li><li>Direct and blind fulfillment options</li><li>Technical substitutions kept visible</li></ul>
          </div>
          <article className="hero-product">
            <div className="hero-product-image"><img src="/products/siglent-sds2000x-plus.jpg" alt="Siglent SDS2354X Plus oscilloscope with test board" /></div>
            <div className="hero-product-info">
              <span>FEATURED TEST EQUIPMENT</span>
              <h2>See more of every signal.</h2>
              <p>SIGLENT SDS2000X Plus Series · up to 350 MHz · 4 channels · 2 GSa/s</p>
              <Link href="/store?q=SDS2000X">Shop oscilloscopes <ArrowRight size={16} /></Link>
            </div>
          </article>
        </section>

        <section className="buying-strip">
          <div className="shell">
            <div><ShieldCheck size={21} /><span><b>Traceable sourcing</b><small>Supplier and fulfillment route shown before purchase.</small></span></div>
            <div><Truck size={21} /><span><b>Direct fulfillment</b><small>Low-overhead shipping without hiding lead times.</small></span></div>
            <div><PackageCheck size={21} /><span><b>Project support</b><small>Quotes, approved alternates, RMAs, and reorders.</small></span></div>
          </div>
        </section>

        <section className="home-section shell">
          <div className="home-section-head"><div><span>PRODUCT CATEGORIES</span><h2>Shop by category</h2></div><Link href="/store">View all products <ArrowRight size={15} /></Link></div>
          <div className="plain-category-grid">
            {categories.map(([name, description, count]) => <Link href={`/store?category=${encodeURIComponent(name)}`} key={name}><span><b>{name}</b><small>{description}</small></span><em>{count} products</em><ArrowRight size={15} /></Link>)}
          </div>
        </section>

        <section className="home-section featured-catalog">
          <div className="shell">
            <div className="home-section-head"><div><span>SAMPLE LAUNCH CATALOG</span><h2>Featured test equipment</h2></div><Link href="/store">Browse the catalog <ArrowRight size={15} /></Link></div>
            <div className="commerce-product-grid">
              {products.map((product) => (
                <article className="commerce-product-card" key={product.sku}>
                  <Link className="commerce-product-image" href={`/store?q=${product.sku}`}><img src={product.image} alt={product.name} /></Link>
                  <div className="commerce-product-body"><div className="commerce-product-meta"><span>{product.brand}</span><code>{product.sku}</code></div><h3><Link href={`/store?q=${product.sku}`}>{product.name}</Link></h3><p>{product.specs}</p><div className="commerce-product-buy"><span><b>{product.price}</b><small>{product.status}</small></span><Link href={`/store?q=${product.sku}`} aria-label={`View ${product.sku}`}>View</Link></div></div>
                </article>
              ))}
            </div>
            <p className="catalog-disclaimer">Illustrative launch pricing and availability; live supplier feeds and commercial agreements must be connected before accepting product orders.</p>
          </div>
        </section>

        <section className="home-section shell supply-services">
          <div className="home-section-head"><div><span>FOR ENGINEERING TEAMS</span><h2>More useful than another product list.</h2></div></div>
          <div className="supply-service-grid">
            <article><span>01</span><h3>Application support</h3><p>Send the voltage, current, bandwidth, isolation, thermal, or compliance target. We match against the actual requirement.</p><Link href="/docs#support">Contact support →</Link></article>
            <article><span>02</span><h3>Direct fulfillment</h3><p>Manufacturer and distributor shipping keeps storage costs low while order ownership, paperwork, and RMA routing stay clear.</p><Link href="/docs#suppliers">Fulfillment program →</Link></article>
            <article><span>03</span><h3>Purchase orders</h3><p>Itemized quotes, project pricing, education and company accounts, and consolidated orders across the build.</p><Link href="/docs#suppliers">Open an account →</Link></article>
          </div>
        </section>

        <section className="works-home shell">
          <div className="works-home-label"><span className="division-mark">TW</span><div><b>THEVENIN WORKS</b><small>THE ENGINEERING DIVISION</small></div></div>
          <div className="works-home-copy"><h2>When the product list needs to become working hardware.</h2><p>License versioned designs, inspect Gerbers locally, source a revision-matched BOM, or commission paid bench verification with a report tied to the exact files tested.</p><div><Link className="commerce-button" href="/marketplace">Browse engineering designs</Link><Link href="/viewer">Open the Gerber workbench →</Link></div></div>
          <ul><li><Link href="/marketplace"><FileText size={18} /><span><b>Design marketplace</b><small>Source, BOM, firmware and test data</small></span></Link></li><li><Link href="/viewer"><Box size={18} /><span><b>Gerber workbench</b><small>Local render plus reference CAM</small></span></Link></li><li><Link href="/lab"><ShieldCheck size={18} /><span><b>Paid verification</b><small>Revision-bound lab evidence</small></span></Link></li></ul>
        </section>

        <section className="name-story">
          <div className="shell"><span>WHY THEVENIN?</span><p>In circuit theory, a Thévenin equivalent reduces a complicated electrical network to one dependable source and impedance. That is the job here: simplify a difficult electronics supply chain without hiding the specification.</p></div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
