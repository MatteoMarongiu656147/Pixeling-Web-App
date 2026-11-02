
/**
 * Displays a fallback page for unknown routes.
 */

import { Link } from 'react-router';

function NotFoundPage() {
  return (
    <main className="main-content">
      <section className="hero">
        <p className="eyebrow">404 ERROR</p>
        <h1>Lost in pixels?</h1>
        <p className="hero-description">
          The page you are looking for does not exist.
        </p>
        <Link className="explore-button" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}

export default NotFoundPage;
