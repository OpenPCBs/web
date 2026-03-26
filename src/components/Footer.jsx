function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="brand-mark footer-brand">
            <span className="brand-icon">◫</span>
            <div>
              <strong>OpenPCB</strong>
              <span>Forkable hardware for everyone.</span>
            </div>
          </div>
          <p>
            Publish KiCad and Altium projects, discover reusable boards, and make open
            hardware easier to search, view, and remix.
          </p>
        </div>
        <div>
          <h4>Starter MVP</h4>
          <ul>
            <li>Public project pages</li>
            <li>Upload flow</li>
            <li>Search and tags</li>
            <li>Simple user dashboard</li>
          </ul>
        </div>
        <div>
          <h4>Next ideas</h4>
          <ul>
            <li>KiCad plugin</li>
            <li>BOM sourcing links</li>
            <li>Version diffs</li>
            <li>Manufacturing handoff</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
