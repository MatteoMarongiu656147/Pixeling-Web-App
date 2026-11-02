/**
 * Creates, retrieves, updates, and follows Pixeling user profiles.
 * Some of these functions are used by authService.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { buildFollowNotificationData } from './notificationService';
import type { UserProfile } from '../types/UserProfile';

// ---------------------------------------------------------------------------------------

// Data needed when creating a new user
type CreateUserProfileData = {
  uid: string;
  username: string;
  displayName: string;
};

// Selects only the interesting properties from the type UserProfile. These are the
// properties that the user can modify in their profile.
export type EditableUserProfile = Pick<
  UserProfile,
  'displayName' | 'bio' | 'profilePictureUrl' | 'bannerUrl'
>;

export type FollowStats = {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

// -------------------------------------------------------------------------------------

// Utility: gets a normalized string of the username
function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

// ------------------------------------------------------------------------------------------------

// Creates a profile and reserves its username atomically. Used in authService to register a user.
// This is not where the authentication is provided. It only adds a new profile to firestore.
export async function createUserProfile(profileData: CreateUserProfileData): Promise<UserProfile> {

  // normalize the username and the display name of a user
  const username = profileData.username.trim();
  const usernameLower = normalizeUsername(username);
  const displayName = profileData.displayName.trim();

  // format check
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    throw new Error(
      'Username must contain 3–20 letters, numbers, or underscores.'
    );
  }

  // there must be a display name for a user
  if (!displayName) {
    throw new Error('Display name is required.');
  }

  // references the new documents we want to create in the collections of usernames and userProfiles
  const usernameRef = doc(db, 'usernames', usernameLower);
  const profileRef = doc(db, 'userProfiles', profileData.uid);

  // creates a new object of type UserProfile
  const profile: UserProfile = {
    uid: profileData.uid,
    username,
    displayName,
    bio: '',
    profilePictureUrl: '',
    bannerUrl: '',
  };

  // Starts the transaction to add the new profile on firestore.
  // Separately inserts the username in the username collection, and the profile data
  // in the profiles collection.
  await runTransaction(db, async (transaction) => {

    const usernameSnapshot = await transaction.get(usernameRef);
    const profileSnapshot = await transaction.get(profileRef);

    const reservedUid = usernameSnapshot.data()?.uid;
    const existingProfileUid = profileSnapshot.data()?.uid;

    if (usernameSnapshot.exists() && reservedUid !== profileData.uid) {
      throw new Error('username-already-taken');
    }

    // A retry after an uncertain transaction result must not overwrite a profile.
    // Reuse an existing reservation only when it belongs to this same Auth UID.
    if (profileSnapshot.exists()) {
      if (existingProfileUid !== profileData.uid) {
        throw new Error('profile-already-exists');
      }

      if (!usernameSnapshot.exists()) {
        transaction.set(usernameRef, { uid: profileData.uid });
      }
      return;
    }

    if (!usernameSnapshot.exists()) {
      transaction.set(usernameRef, { uid: profileData.uid });
    }
    transaction.set(profileRef, { ...profile, usernameLower });
  });

  return profile;
}

// --------------------------------------------------------------------------------------------------

// Retrieves a public profile using its case-insensitive username.
export async function getUserProfileByUsername(username: string): Promise<UserProfile | null> {

  // Reference to the document in the collection usernames and snapshot it
  const usernameRef = doc(
    db,
    'usernames',
    normalizeUsername(username)
  );
  const usernameSnapshot = await getDoc(usernameRef);

  if (!usernameSnapshot.exists()) {
    return null;
  }

  // Uses the uid to retrieve the user with that username
  return getUserProfileByUid(usernameSnapshot.data().uid);
}

// --------------------------------------------------------------------------------------------

// Retrieves a profile using the stable Firebase Authentication UID.
export async function getUserProfileByUid(uid: string): Promise<UserProfile | null> {

  // reference and snapshot to the document from the collection
  const profileRef = doc(db, 'userProfiles', uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    return null;
  }

  return profileSnapshot.data() as UserProfile;
}

// ---------------------------------------------------------------------------------------------

// Retrieves all public user profiles for the "Pixelers" search (used in SearchPage)
// SearchPage will then filter the content of this result to match the search parameters
export async function getAllUserProfiles(): Promise<UserProfile[]> {

  // collection and documents of the collection's references
  const profilesCollection = collection(db, 'userProfiles');
  const profilesSnapshot = await getDocs(profilesCollection);

  // return the built object through mapping the snapshot
  return profilesSnapshot.docs.map(
    (profileDocument) => profileDocument.data() as UserProfile
  );
}

// ---------------------------------------------------------------------------------------------

// Updates editable profile fields (displayme, bio, profile picture and banner) 
// This does not include the username: the unique username is immutable.
export async function updateUserProfile(uid: string, profileChanges: EditableUserProfile): Promise<void> {

  // reference to the document of the profile we want to modify
  const profileRef = doc(db, 'userProfiles', uid);

  // updates the document with the new properties in firestore
  await updateDoc(profileRef, {
    displayName: profileChanges.displayName.trim(),
    bio: profileChanges.bio.trim(),
    profilePictureUrl: profileChanges.profilePictureUrl,
    bannerUrl: profileChanges.bannerUrl,
  });
}

// ----------------------------------------------------------------------------------------------------------

// Retrieves follower and following counts and the viewer's follow status.
// This function is used in ProfilePage to load the statistics and show it in the page
export async function getFollowStats(profileUid: string, viewerUid: string | null): Promise<FollowStats> {

  // Queries the following users and follower users for a user
  const followersQuery = query(
    collection(db, 'follows'),
    where('targetUid', '==', profileUid)
  );
  const followingQuery = query(
    collection(db, 'follows'),
    where('followerUid', '==', profileUid)
  );

  // gets the snapshot of both collections
  const [followersSnapshot, followingSnapshot] = await Promise.all([
    getDocs(followersQuery),
    getDocs(followingQuery),
  ]);

  let isFollowing = false;

  // the "isFollowing" property can be true only if the current user doesn't own the profile
  // (you can't follow yourself).
  if (viewerUid && viewerUid !== profileUid) {
    const followRef = doc(db, 'follows', `${viewerUid}_${profileUid}`);
    const followSnapshot = await getDoc(followRef);
    isFollowing = followSnapshot.exists();
  }

  // Returns the following statistics: number of followers, number of following
  // in a profile, and if you are following that user or not.
  return {
    followerCount: followersSnapshot.size,
    followingCount: followingSnapshot.size,
    isFollowing,
  };
}

// --------------------------------------------------------------------------------------------------

// Resolves unique profile UIDs from the existing follows collection. This utility is used
// in the getter functions below.
async function getRelatedProfiles(profileUid: string,
                                  relationshipField: 'followerUid' | 'targetUid'
                                  ): Promise<UserProfile[]> {

  // Queries the follow collection, getting the data related only to the specified UID
  // Then snapshots the results
  const relationshipsQuery = query(
    collection(db, 'follows'),
    where(relationshipField, '==', profileUid)
  );
  const relationshipsSnapshot = await getDocs(relationshipsQuery);

  const relatedUids = new Set<string>();

  relationshipsSnapshot.docs.forEach((relationshipDocument) => {
    const relatedUid: unknown = relationshipDocument.data()[
      relationshipField === 'followerUid' ? 'targetUid' : 'followerUid'
    ];

    // Ignore malformed and self-referencing records, and avoid duplicate cards.
    if (typeof relatedUid === 'string' && relatedUid !== profileUid) {
      relatedUids.add(relatedUid);
    }
  });

  // A deleted profile is omitted, while actual Firestore read errors still reach the page.
  const profiles = await Promise.all(
    [...relatedUids].map((relatedUid) => getUserProfileByUid(relatedUid))
  );

  return profiles.filter(
    (relatedProfile): relatedProfile is UserProfile =>
      relatedProfile !== null
  );
}

// -----------------------------------------------------------------------------------------------

// These two functions call the one above to get the object containing followers or following

// Retrieves profiles followed by the selected user (followerUid -> targetUid).
export function getFollowingProfiles(profileUid: string): Promise<UserProfile[]> {
  return getRelatedProfiles(profileUid, 'followerUid');
}

// Retrieves profiles that follow the selected user (targetUid <- followerUid).
export function getFollowerProfiles(profileUid: string): Promise<UserProfile[]> {
  return getRelatedProfiles(profileUid, 'targetUid');
}

// -----------------------------------------------------------------------------------------------

// Applies the requested follow state, making retries safe and repeatable.
// This function toggles (on/off) the following status and updates it in firestore.
export async function setFollowStatus(followerUid: string,
                                      targetUid: string,
                                      shouldFollow: boolean
                                     ): Promise<void> {

  
  
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid || authenticatedUid !== followerUid) {
    throw new Error('Please log in to follow another profile.');
  }
  if (followerUid === targetUid) {
    throw new Error('You cannot follow your own profile.');
  }

  // Gets the reference to the document from the collection follows
  const followRef = doc(
    db,
    'follows',
    `${followerUid}_${targetUid}`
  );



  const notificationRef = doc(collection(db, 'notifications'));
  const actorProfileRef = doc(db, 'userProfiles', followerUid);
  const targetProfileRef = doc(db, 'userProfiles', targetUid);

  // begin transaction to add the follow event in firestore
  await runTransaction(db, async (transaction) => {

    // gets the snapshot of the document
    const followSnapshot = await transaction.get(followRef);

    // A fresh ID is assigned to every newly-created relationship, so a later
    // follow after an unfollow is a distinct notification event.
    if (followSnapshot.exists() && !shouldFollow) {
      transaction.delete(followRef);
    } else if (!followSnapshot.exists() && shouldFollow) {
      const [actorProfileSnapshot, targetProfileSnapshot] = await Promise.all([
        transaction.get(actorProfileRef),
        transaction.get(targetProfileRef),
      ]);
      const actorUsername = actorProfileSnapshot.data()?.username;

      if (!actorProfileSnapshot.exists() || typeof actorUsername !== 'string') {
        throw new Error('Your public profile could not be found.');
      }

      if (!targetProfileSnapshot.exists()) {
        throw new Error('The profile you are trying to follow was not found.');
      }

      transaction.set(followRef, {
        followerUid,
        targetUid,
        eventId: notificationRef.id,
      });
      // The notification and follow record commit together; rules verify both sides.
      transaction.set(
        notificationRef,
        buildFollowNotificationData(
          followerUid,
          actorUsername,
          targetUid
        )
      );
    }
  });
}
