
/**
 * Defines the shared data structure for an artwork.
 */
export type Artwork = {
  id: string;
  imageUrl: string;
  title: string;
  // The immutable username identifies the author in the current profile routes.
  artistUsername: string;
  tags?: string[];
  description?: string;
  artistUid?: string;
  createdAt?: string;
  // Likes are stored as Firebase UIDs; comments live in a separate subcollection.
  likes?: string[];
  /** Maps each liked UID to the unique event ID used by its notification. */
  likeEventIds?: Record<string, string>;
};
