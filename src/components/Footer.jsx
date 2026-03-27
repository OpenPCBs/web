function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="brand-mark footer-brand">
            <span className="brand-icon">◫</span>
            <div>
              <strong>OpenPCB</strong>
              <span>Publish boards. Preview files. Quote fabrication.</span>
            </div>
          </div>
          <p>OpenPCB is built for sharing real hardware files with enough structure for reuse, quoting, and manufacturing handoff.</p>
        </div>
        <div>
          <h4>Core workflow</h4>
          <ul>
            <li>Publish live project pages</li>
            <li>Preview uploads before posting</li>
            <li>Explore public boards</li>
            <li>Fork into your workspace</li>
          </ul>
        </div>
        <div>
          <h4>Integrations</h4>
          <ul>
            <li>Clerk authentication</li>
            <li>Supabase data and storage</li>
            <li>JLCPCB and PCBWay quotes</li>
            <li>Stripe checkout</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
