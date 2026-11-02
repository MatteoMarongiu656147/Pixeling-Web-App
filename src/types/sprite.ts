
/** Defines the shared information stored for each sprite. */
type SpriteBase = {
  id: string;
  title: string;
  description: string;
  // The immutable username identifies the author in the current profile routes.
  artistUsername: string;
  artistUid?: string;
  tags?: string[];
  createdAt?: string;
  // Likes are stored as Firebase UIDs; comments live in a separate subcollection.
  likes?: string[];
  /** Maps each liked UID to the unique event ID used by its notification. */
  likeEventIds?: Record<string, string>;
};

export type StaticSprite = SpriteBase & {
  type: 'static';
  previewUrl: string;
};

export type AnimatedSprite = SpriteBase & {
  type: 'animated';
  animationUrl: string;
};

export type Sprite = StaticSprite | AnimatedSprite;
