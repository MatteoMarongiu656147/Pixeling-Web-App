
/**
 * Displays a grid of artwork cards provided by the parent component.
 */
import type { Artwork } from '../../types/artwork';
import ArtworkCard from './ArtworkCard';

// The component takes an array of Artworks as a prop, and an optional function onDelete
// that takes the ID of the artwork as a parameter and returns nothing.
// The onDelete function is passed to ArtworkGrid from the ProfilePage if the profile shown
// is the one of the logged user.
function ArtworkGrid(props: {artworks: Artwork[]; onDelete?: (artworkId: string) => void;}) {
  const artworks = props.artworks;

  return (
    <div className="artwork-grid">
      {artworks.map((currentArtwork) => (
        <ArtworkCard
          key={currentArtwork.id}
          artwork={currentArtwork}
          onDelete={props.onDelete}
        />
      ))}
    </div>
  );
}

export default ArtworkGrid;
