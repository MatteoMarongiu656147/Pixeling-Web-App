
/**
 * Displays the Pixeling landing page, without authentication.
 */

import { useEffect, useState } from 'react';
import FeaturedArtworkGrid from '../components/artwork/FeaturedArtworkGrid';
import { getAllArtworks } from '../services/artworkService';
import type { Artwork } from '../types/artwork';

function WelcomePage() {
  const [latestArtworks, setLatestArtworks] = useState<Artwork[]>([]);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);
  const [artworkLoadError, setArtworkLoadError] = useState('');

  // The artwork service returns every document, sorted by valid creation date.
  // Taking the first four keeps the welcome preview focused on the latest work.
  useEffect(() => {

    let isActive = true;

    async function loadLatestArtworks() {
      try {
        // calls the artworkService
        const loadedArtworks = await getAllArtworks();

        if (isActive) {
          // sets the four latest artworks from all the artworks
          setLatestArtworks(loadedArtworks.slice(0, 4));
        }
      } catch (error) {
        if (isActive) {
          console.error('Unable to load welcome page artworks:', error);
          setArtworkLoadError('Unable to load artwork previews. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingArtworks(false);
        }
      }
    }

    // executes the just defined function
    void loadLatestArtworks();

    return () => {
      // Ignore a pending Firestore response if the welcome page is closed.
      isActive = false;
    };
  }, []);

  return (
    <main className="main-content">
      <section className="hero">
        <p className="eyebrow">YOUR PIXEL ART COMMUNITY</p>

        <h1>
          Small pixels.
          <br />
          Big <span>worlds.</span>
        </h1>

        <p className="hero-description">
          Discover new artwork, share your creativity,
          and meet artists from around the world.
        </p>

      </section>

      <section className="discover" id="discover">
        <div>
          <h2>A world to discover.</h2>
        </div>

        <p className="section-description">
          Latest artwork:
        </p>

        {isLoadingArtworks ? (
          <p className="section-description">Loading artwork previews...</p>
        ) : artworkLoadError ? (
          <p className="section-description" role="alert">
            {artworkLoadError}
          </p>
        ) : latestArtworks.length === 0 ? (
          <p className="section-description">
            No artworks have been published yet.
          </p>
        ) : (
          <FeaturedArtworkGrid artworks={latestArtworks} />
        )}
      </section>
    </main>
  );
}

export default WelcomePage;
