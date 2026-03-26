import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="section">
      <div className="container empty-state">
        <span className="eyebrow">404</span>
        <h1>That page is not here</h1>
        <p>Try going back to the homepage or exploring the public projects.</p>
        <Link to="/" className="button button-primary">
          Go home
        </Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
