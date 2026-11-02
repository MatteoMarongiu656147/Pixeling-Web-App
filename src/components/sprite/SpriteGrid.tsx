
/**
 * Displays a grid of sprite cards provided by the parent component.
 */
import type { Sprite } from '../../types/sprite';
import SpriteCard from './SpriteCard';

// The component takes an array of Sprites as a prop, and an optional function onDelete
// that takes the ID of the sprite as a parameter and returns nothing.
// The onDelete function is passed to SpriteGrid from the ProfilePage if the profile shown
// is the one of the logged user.
function SpriteGrid(props: {sprites: Sprite[]; onDelete?: (spriteId: string) => void;}) {
  const sprites = props.sprites;

  return (
    <div className="artwork-grid">
      {sprites.map((currentSprite) => (
        <SpriteCard
          key={currentSprite.id}
          sprite={currentSprite}
          onDelete={props.onDelete}
        />
      ))}
    </div>
  );
}

export default SpriteGrid;

