
/**
 * Renders a single artwork preview with navigation to its details.
 * Used in ArtworkGrid.
 */

import { Link } from 'react-router';
import type { Artwork } from '../../types/artwork';
import TagList from '../content/TagList';
import DeleteContentButton from '../content/DeleteContentButton';

// The component takes an artwork of type Artwork as a prop, and an optional function onDelete
// that takes the ID of the artwork as a parameter and returns nothing.
// These props are propagated from ArtworkdGrid, and further from ArtworkPage or ProfilePage.
// If there is an onDelete function in the props, a DeleteContentButton is shown,
// making deleting an artwork possible.
// The onDelete function is passed to ArtworkGrid from the ProfilePage if the profile shown
// is the one of the logged in user.
function ArtworkCard(props: {artwork: Artwork; onDelete?: (artworkId: string) => void;}) {
  const artwork = props.artwork;

  return (
    <article className="artwork-card">
      {props.onDelete && (
        <DeleteContentButton
          contentType="artwork"
          onDelete={() => props.onDelete?.(artwork.id)}
        />
      )}

      <Link to={`/artworks/${artwork.id}`}>
        <img
          className="artwork-image"
          src={artwork.imageUrl}
          alt={artwork.title}
        />
      </Link>

      <div className="artwork-info">
        <h3>
          <Link to={`/artworks/${artwork.id}`}>
            {artwork.title}
          </Link>
        </h3>
        <p>
          by <Link to={`/profile/${artwork.artistUsername}`}>
            {artwork.artistUsername}
          </Link>
        </p>
        <TagList tags={artwork.tags} />
      </div>
    </article>
  );
}

export default ArtworkCard;
