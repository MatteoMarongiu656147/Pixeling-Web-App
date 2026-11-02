/**
 * Creates and retrieves artwork documents in Firestore.
 * Artwork images are stored as Data URLs.
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
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import type { Artwork } from '../types/artwork';
import { sortByCreatedAtNewestFirst } from '../utils/sortByCreatedAt';

// These are the data the user inserts when he wants to create and publish artwork content.
type CreateArtworkData = {
  title: string;
  description: string;
  artistUid: string;
  artistUsername: string;
  tags: string[];
  imageDataUrl: string;
};

// A 100 KiB image becomes at most 136,559 characters after Base64 encoding and its prefix.
// We assume a limit of 100 KiB for the artwork files (Firestore documents can reach up to 1 MiB).
const MAX_IMAGE_DATA_URL_LENGTH = 136_559;


// ----------------------------------------------------------------------------------------------------

// Function to create an artwork and add it to firestore
export async function createArtwork(artworkData: CreateArtworkData): Promise<string> {

  // Check the Data URL before sending it to Firestore.
  if (!/^data:image\/(jpeg|png);base64,/.test(artworkData.imageDataUrl)) {
    throw new Error('The artwork image must be a PNG or JPG Data URL.');
  }

  // Won't publish if it's larger than 100 KiB
  if (artworkData.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error('The artwork image must be 100 KiB or smaller.');
  }

  // Retrieves the collection of artworks from firestore.
  const artworksCollection = collection(db, 'artworks');

  // Adds the new artwork to the collection in firestore, using user's provided data.
  const artworkDocument = await addDoc(artworksCollection, {
    title: artworkData.title,
    description: artworkData.description,
    imageUrl: artworkData.imageDataUrl,
    artistUid: artworkData.artistUid,
    artistUsername: artworkData.artistUsername,
    tags: artworkData.tags,
    createdAt: serverTimestamp(),
  });

  return artworkDocument.id;
}


// ------------------------------------------------------------------------------------------------------

// Retrieves all artworks created by a specific Firebase user.
export async function getArtworksByArtistUid(artistUid: string): Promise<Artwork[]> {

  // gets the collection from firestore
  const artworksCollection = collection(db, 'artworks');

  // asks the artworks owned by a specific user by UID
  const artworksQuery = query(artworksCollection, where('artistUid', '==', artistUid));

  // retrieves the result of the query
  const artworksSnapshot = await getDocs(artworksQuery);


  // builds the array of artworks by mapping the docs in the snapshot received
  const artworks = artworksSnapshot.docs.map((artworkDocument) => {
    const artworkData = artworkDocument.data();

    const { artistName: legacyArtistName, ...artworkFields } = artworkData;
    const createdAt =
      typeof artworkData.createdAt?.toDate === 'function'
        ? artworkData.createdAt.toDate().toISOString()
        : typeof artworkData.createdAt === 'string'
          ? artworkData.createdAt
          : undefined;

    return {
      ...artworkFields,
      id: artworkDocument.id,
      // Read older documents that stored the immutable username as artistName.
      artistUsername:
        typeof artworkData.artistUsername === 'string'
          ? artworkData.artistUsername
          : typeof legacyArtistName === 'string'
            ? legacyArtistName
            : '',
      createdAt,
    } as Artwork;
  });


  // Newest artworks appear first (sort function)
  artworks.sort((firstArtwork, secondArtwork) => {
    const firstDate = firstArtwork.createdAt
      ? new Date(firstArtwork.createdAt).getTime()
      : 0;
    const secondDate = secondArtwork.createdAt
      ? new Date(secondArtwork.createdAt).getTime()
      : 0;

    return secondDate - firstDate;
  });


  // returns the found artworks
  return artworks;
}


// ---------------------------------------------------------------------------------------------------

/** Retrieves public artworks for client-side search across the collection. */
export async function getAllArtworks(): Promise<Artwork[]> {

  // gets the collection and the documents in the collection
  const artworksCollection = collection(db, 'artworks');
  const artworksSnapshot = await getDocs(artworksCollection);

  // builds the array by mapping the documents
  const artworks = artworksSnapshot.docs.map((artworkDocument) => {
    const artworkData = artworkDocument.data();
    const { artistName: legacyArtistName, ...artworkFields } = artworkData;
    const createdAt =
      typeof artworkData.createdAt?.toDate === 'function'
        ? artworkData.createdAt.toDate().toISOString()
        : typeof artworkData.createdAt === 'string'
          ? artworkData.createdAt
          : undefined;

    return {
      ...artworkFields,
      id: artworkDocument.id,
      // Older documents may still store the immutable username as artistName.
      artistUsername:
        typeof artworkData.artistUsername === 'string'
          ? artworkData.artistUsername
          : typeof legacyArtistName === 'string'
            ? legacyArtistName
            : '',
      createdAt,
    } as Artwork;
  });

  return sortByCreatedAtNewestFirst(artworks);
}


// --------------------------------------------------------------------------------------------------------

/** Retrieves a single artwork using its Firestore document ID. */
export async function getArtworkById(artworkId: string): Promise<Artwork | null> {

  // gets the snapshot of the document of the specified artwork by id
  const artworkReference = doc(db, 'artworks', artworkId);
  const artworkSnapshot = await getDoc(artworkReference);

  if (!artworkSnapshot.exists()) {
    return null;
  }

  const artworkData = artworkSnapshot.data(); // extracts the data from the artwork snapshot

  const { artistName: legacyArtistName, ...artworkFields } = artworkData;

  // Date of creation
  const createdAt =
    typeof artworkData.createdAt?.toDate === 'function'
      ? artworkData.createdAt.toDate().toISOString()
      : typeof artworkData.createdAt === 'string'
        ? artworkData.createdAt
        : undefined;

  return {
    ...artworkFields,
    id: artworkSnapshot.id,
    // Read older documents that stored the immutable username as artistName.
    artistUsername:
      typeof artworkData.artistUsername === 'string'
        ? artworkData.artistUsername
        : typeof legacyArtistName === 'string'
          ? legacyArtistName
          : '',
    createdAt,
  } as Artwork;
}

// --------------------------------------------------------------------------------------------

/**
 * Deletes an artwork document from Firestore.
 */
export async function deleteArtworkById(artworkId: string): Promise<void> {

  const artworkReference = doc(db, 'artworks', artworkId);

  await deleteDoc(artworkReference);
}
