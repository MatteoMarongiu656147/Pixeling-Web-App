/**
 * Creates and retrieves sprite documents in Firestore.
 * Static images and animated GIFs are stored as Data URLs, without Storage.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import type { Sprite } from '../types/sprite';
import { sortByCreatedAtNewestFirst } from '../utils/sortByCreatedAt';

// Used when creating a new sprite
type CreateSpriteData = {
  title: string;
  description: string;
  artistUid: string;
  artistUsername: string;
  tags: string[];
} & (
  | { type: 'static'; previewUrl: string }
  | { type: 'animated'; animationUrl: string }
);

// A 50 KiB image becomes about 68,300 characters after Base64 encoding and its Data URL prefix.
const MAX_SPRITE_DATA_URL_LENGTH = 68300;

// ----------------------------------------------------------------------------------------------

// Normalize new and older Firestore records into the current Sprite type.
function mapSpriteDocument(
  spriteId: string,
  spriteData: Record<string, unknown>
): Sprite {
  const { artistName: legacyArtistName, ...spriteFields } = spriteData;
  const createdAtValue = spriteData.createdAt;
  const createdAt =
    createdAtValue instanceof Timestamp
      ? createdAtValue.toDate().toISOString()
      : typeof createdAtValue === 'string'
        ? createdAtValue
        : undefined;

  return {
    ...spriteFields,
    id: spriteId,
    // Older documents used artistName for the same immutable username.
    artistUsername:
      typeof spriteData.artistUsername === 'string'
        ? spriteData.artistUsername
        : typeof legacyArtistName === 'string'
          ? legacyArtistName
          : '',
    createdAt,
  } as Sprite;
}

// ---------------------------------------------------------------------------------------------------

// Creates a new sprite and adds it to the collection of sprites in firestore
export async function createSprite(spriteData: CreateSpriteData): Promise<string> {

  const imageDataUrl =
    spriteData.type === 'static'
      ? spriteData.previewUrl
      : spriteData.animationUrl;
  const expectedDataUrlPattern =
    spriteData.type === 'static'
      ? /^data:image\/(jpeg|png);base64,/
      : /^data:image\/gif;base64,/;

  // consistency check for the type of content (gif or png/jpeg)
  if (!expectedDataUrlPattern.test(imageDataUrl)) {
    throw new Error(
      spriteData.type === 'static'
        ? 'A static sprite must use a JPEG or PNG Data URL.'
        : 'An animated sprite must use a GIF Data URL.'
    );
  }

  // Max 50 KB for uploaded files
  if (imageDataUrl.length > MAX_SPRITE_DATA_URL_LENGTH) {
    throw new Error('The sprite file must be 50 KB or smaller.');
  }

  // reference to the collection of sprites to add the document containing the new sprite
  const spritesCollection = collection(db, 'sprites');
  const spriteDocument = await addDoc(spritesCollection, {
    ...spriteData,
    createdAt: serverTimestamp(),
  });

  // returns the id of the new sprite
  return spriteDocument.id;
}

// ------------------------------------------------------------------------------------

// Loads only sprites created by the requested Firebase user.
export async function getSpritesByArtistUid(artistUid: string): Promise<Sprite[]> {

  // reference to the collection and query to get the snapshot of the docs
  // where the sprite is created by a specific user (by UID)
  const spritesCollection = collection(db, 'sprites');
  const spritesQuery = query(
    spritesCollection,
    where('artistUid', '==', artistUid)
  );
  const spritesSnapshot = await getDocs(spritesQuery);

  // maps the retrieved documents into a usable object (see mapSpriteDocument)
  const sprites = spritesSnapshot.docs.map((spriteDocument) => {
    const spriteData = spriteDocument.data();
    return mapSpriteDocument(spriteDocument.id, spriteData);
  });

  // Keep the same newest-first ordering used for artworks.
  sprites.sort((firstSprite, secondSprite) => {
    const firstDate = firstSprite.createdAt
      ? new Date(firstSprite.createdAt).getTime()
      : 0;
    const secondDate = secondSprite.createdAt
      ? new Date(secondSprite.createdAt).getTime()
      : 0;

    return secondDate - firstDate;
  });

  // return the sprites object after sorting them
  return sprites;
}

// ------------------------------------------------------------------------------------

/** Retrieves public sprites for client-side search across the collection. */
export async function getAllSprites(): Promise<Sprite[]> {

  // reference, query and object mapping from the snapshot
  const spritesCollection = collection(db, 'sprites');
  const spritesSnapshot = await getDocs(spritesCollection);
  const sprites = spritesSnapshot.docs.map((spriteDocument) =>
    mapSpriteDocument(spriteDocument.id, spriteDocument.data())
  );

  // returns the sprites object sorting it with this function from src/utils/sortByCreatedAt
  return sortByCreatedAtNewestFirst(sprites);
}

// ------------------------------------------------------------------------------------

/** Retrieves one sprite using its Firestore document ID. */
export async function getSpriteById(spriteId: string): Promise<Sprite | null> {

  // reference and snapshot
  const spriteReference = doc(db, 'sprites', spriteId);
  const spriteSnapshot = await getDoc(spriteReference);

  if (!spriteSnapshot.exists()) {
    return null;
  }

  // returns the object with the normalized sprite type in the app
  return mapSpriteDocument(spriteSnapshot.id, spriteSnapshot.data());
}

// -------------------------------------------------------------------------

/** Deletes a sprite document using its Firestore document ID. */
export async function deleteSpriteById(spriteId: string): Promise<void> {
  const spriteReference = doc(db, 'sprites', spriteId);

  await deleteDoc(spriteReference);
}
