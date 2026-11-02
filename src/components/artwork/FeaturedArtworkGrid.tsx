/**
 * Displays a grid of featured artwork previews without interactive links.
 * This component is used on the WelcomePage only.
 */
import type { Artwork } from '../../types/artwork';

type FeaturedGridProps = {
  artworks: Artwork[];
};

function FeaturedArtworkGrid(props: FeaturedGridProps) {
  const artworks = props.artworks;

  return (
    <div className="featured-grid">
      {artworks.map((currentArtwork) => (
        <article
          className="featured-card"
          key={currentArtwork.id}
        >
          <img
            className="featured-image"
            src={currentArtwork.imageUrl}
            alt={currentArtwork.title}
            loading="lazy"
          />
        </article>
      ))}
    </div>
  );
}

export default FeaturedArtworkGrid;