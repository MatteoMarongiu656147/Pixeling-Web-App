/** Displays all static and animated sprites stored in Firestore. 
 * This page is shown when the user clicks on view all in the homepage,
 * in the sprites section.
*/

import { useEffect, useState } from 'react';
import SpriteGrid from '../components/sprite/SpriteGrid';
import { getAllSprites } from '../services/spriteService';
import type { Sprite } from '../types/sprite';

function SpritesPage() {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Sprite types keep static previews and animated GIFs distinct in the grid.
  useEffect(() => {
    let isActive = true;

    async function loadSprites() {
      try {
        // calls the spriteService to get all sprites
        const loadedSprites = await getAllSprites();
        if (isActive) setSprites(loadedSprites);
      } catch (error) {
        if (isActive) {
          console.error('Unable to load sprites:', error);
          setErrorMessage('Unable to load sprites. Please try again.');
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    // calls the function to load the sprites
    void loadSprites();

    return () => {
      // prevents invalid operations when the component is unmounted
      isActive = false;
    };
  }, []);

  return (
    <main className="main-content">
      <section className="discover">
        <div>
          <h1>Discover Sprites.</h1>
        </div>

        <p className="section-description">
          Discover animated characters and pixel art animations.
        </p>

        {isLoading ? (
          <p className="section-description">Loading sprites...</p>
        ) : errorMessage ? (
          <p className="section-description" role="alert">{errorMessage}</p>
        ) : sprites.length === 0 ? (
          <p className="section-description">No sprites have been published yet.</p>
        ) : (
          <SpriteGrid sprites={sprites} />
        )}
      </section>
    </main>
  );
}

export default SpritesPage;
