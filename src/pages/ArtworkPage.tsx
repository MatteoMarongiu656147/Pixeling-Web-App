/** Displays all artworks stored in Firestore. 
 * This page is shown when the user clicks on "view all"
 * in the artwork section in the home page
*/

import { useEffect, useState } from 'react';
import ArtworkGrid from '../components/artwork/ArtworkGrid';
import { getAllArtworks } from '../services/artworkService';
import type { Artwork } from '../types/artwork';

function ArtworkPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // The service converts Firestore dates and sorts valid dates newest first.
  useEffect(() => {
    let isActive = true;

    async function loadArtworks() {
      try {
        // calls the artworkService
        const loadedArtworks = await getAllArtworks();

        if (isActive) setArtworks(loadedArtworks);
      } catch (error) {
        if (isActive) {
          console.error('Unable to load artworks:', error);
          setErrorMessage('Unable to load artworks. Please try again.');
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    // calls the defined function
    void loadArtworks();

    return () => {
      // Do not update state if navigation unmounts this page during the request.
      isActive = false;
    };
  }, []);

  return (
    <main className="main-content">
      <section className="discover">
        <div>
          <h1>Discover Artwork.</h1>
        </div>

        <p className="section-description">
          Find inspiration from pixel artists around the world.
        </p>

        {isLoading ? (
          <p className="section-description">Loading artworks...</p>
        ) : errorMessage ? (
          <p className="section-description" role="alert">{errorMessage}</p>
        ) : artworks.length === 0 ? (
          <p className="section-description">No artworks have been published yet.</p>
        ) : (
          <ArtworkGrid artworks={artworks} />
        )}
      </section>
    </main>
  );
}

export default ArtworkPage;
