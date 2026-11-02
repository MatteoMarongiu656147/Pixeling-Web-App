
/**
 * Displays a sprite preview and links to its detail page.
 */
import { Link } from 'react-router';
import type { Sprite } from '../../types/sprite';
import TagList from '../content/TagList';
import DeleteContentButton from '../content/DeleteContentButton';

// The component takes a sprite of type Sprite as a prop, and an optional function onDelete
// that takes the ID of the sprite as a parameter and returns nothing.
// These props are propagated from SpriteGrid, and further from SpritesPage or ProfilePage.
// If there is an onDelete function in the props, a DeleteContentButton is shown,
// making deleting a sprite possible.
// The onDelete function is passed to SpriteGrid from the ProfilePage if the profile shown
// is the one of the logged in user.
function SpriteCard(props: {sprite: Sprite; onDelete?: (spriteId: string) => void;}) {
  const sprite = props.sprite;

  return (
    <article className="artwork-card">
      {props.onDelete && (
        <DeleteContentButton
          contentType="sprite"
          onDelete={() => props.onDelete?.(sprite.id)}
        />
      )}

      <Link to={`/sprites/${sprite.id}`}>
        <img
          className="artwork-image"
          src={sprite.type === 'animated'
            ? sprite.animationUrl
            : sprite.previewUrl}
          alt={sprite.title}
        />
      </Link>

      <div className="artwork-info">
        <h3>
          <Link to={`/sprites/${sprite.id}`}>
            {sprite.title}
          </Link>
        </h3>

        <p>
          by <Link to={`/profile/${sprite.artistUsername}`}>
            {sprite.artistUsername}
          </Link>
        </p>

        {sprite.type === 'animated' ? (
          <p>Animated sprite</p>
        ) : (
          <p>Static sprite</p>
        )}
        <TagList tags={sprite.tags} />
      </div>
    </article>
  );
}

export default SpriteCard;
