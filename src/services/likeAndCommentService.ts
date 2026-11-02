/** Persists and observes likes and comments for artwork and sprite documents. */

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

import type { Unsubscribe } from 'firebase/firestore';

import { auth, db } from './firebase';
import { buildContentNotificationData } from './notificationService';
import { getUserProfileByUid } from './userProfileService';
import type { ContentComment } from '../types/comment';

// ----------------------------------------------------------------------------

export type LikeableContentType = 'artwork' | 'sprite';

// ----------------------------------------------------------------------------

function getContentCollection(contentType: LikeableContentType) {
  return contentType === 'artwork' ? 'artworks' : 'sprites';
}

function getSignedInUid(): string {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('Please log in to use likes and comments.');
  }

  return currentUser.uid;
}

// -------------------------------------------------------------------------------------------------------

// Utility function: it receives a value it does not trust, checks its structure, 
// and returns only the data that has the correct type.
function readLikeEventIds(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  // Transforms the data received in a key-value structure, and filters it to
  // delete whatever has not a string as the "value".
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

// --------------------------------------------------------------------------------------------------------

/** Utility: converts a Firestore comment document into the ISO-date type used by React
 * (See use in subscribeToContentComments)
 */
function mapCommentDocument(
  commentId: string,
  commentData: Record<string, unknown>
): ContentComment {
  const storedDate = commentData.createdAt;
  const createdAt =
    storedDate instanceof Timestamp
      ? storedDate.toDate().toISOString()
      : typeof storedDate === 'string'
        ? storedDate
        : '';

  return {
    id: commentId,
    userUid: typeof commentData.userUid === 'string' ? commentData.userUid : '',
    username:
      typeof commentData.username === 'string' ? commentData.username : '',
    text: typeof commentData.text === 'string' ? commentData.text : '',
    createdAt,
  };
}

// ----------------------------------------------------------------------------------------------------------------

/** Records the user's like in firestore, prevents duplicates, and creates a notification for the content author,
 * all within a Firestore transaction. */
export async function addContentLike(contentType: LikeableContentType, contentId: string): Promise<void> {

  const userUid = getSignedInUid();

  // gets the doc from firestore (artwork or sprite, based on contentType)
  const contentReference = doc(db, getContentCollection(contentType), contentId);

  // gets the user's Profile by their UID
  const profile = await getUserProfileByUid(userUid);
  if (!profile?.username) {
    throw new Error('Your public profile could not be found.');
  }

  // Starts the transaction in Firestore
  await runTransaction(db, async (transaction) => {

    // Retrieves the snapshot of the content 
    const contentSnapshot = await transaction.get(contentReference);
    if (!contentSnapshot.exists()) {
      throw new Error('This content no longer exists.');
    }
    const contentData = contentSnapshot.data();

    // Extracts the array of likes from the obtained snapshot
    const storedLikes = Array.isArray(contentData.likes)
      ? contentData.likes.filter((uid): uid is string => typeof uid === 'string')
      : [];

    // Repeating an already completed like is a no-op and cannot duplicate its notice.
    if (storedLikes.includes(userUid)) {
      return;
    }

    // readLikeEventIds(...) cleans up the map of "like" event identifiers, keeping only the string values.
    const storedEventIds = readLikeEventIds(contentData.likeEventIds);
    // doc(collection(db, 'notifications')).id generates a new ID for a document in the 'notifications' collection.
    // this ID will be the new like's ID.
    const likeEventId = doc(collection(db, 'notifications')).id;

    // Updates the document stored in contentReference, adding the new like with an arrayUnion,
    // and adding the like event to the list of like events for the same content.
    transaction.update(contentReference, {
      likes: arrayUnion(userUid),
      likeEventIds: { ...storedEventIds, [userUid]: likeEventId },
    });


    // Writes and adds a new distinct notification document in firestore for the like event.
    const authorUid = contentData.artistUid;
    // Prevent a user to notify themselves when he likes a content of his own
    if (typeof authorUid === 'string' && authorUid !== userUid) {
      const notificationReference = doc(db, 'notifications', likeEventId);

      // transaction.set writes the data in the doc notificationReference
      transaction.set(
        notificationReference,
        // calls the notificationService's function to build a notification
        buildContentNotificationData(
          'like',
          userUid,
          profile.username,
          authorUid,
          contentType,
          contentId
        )
      );
    }
  });
}


// ----------------------------------------------------------------------------------------------------------

/** Removes only the authenticated user's UID from the content's likes. */
export async function removeContentLike(contentType: LikeableContentType, contentId: string): Promise<void> {

  const userUid = getSignedInUid();

  // references the collection of artworks/sprites
  const contentReference = doc(db, getContentCollection(contentType), contentId);

  await runTransaction(db, async (transaction) => {

    // gets a snapshot of the collection
    const contentSnapshot = await transaction.get(contentReference);
    if (!contentSnapshot.exists()) {
      throw new Error('This content no longer exists.');
    }

    // extracts the data from the snapshot and turns it into an array
    const contentData = contentSnapshot.data();
    const storedLikes = Array.isArray(contentData.likes)
      ? contentData.likes.filter((uid): uid is string => typeof uid === 'string')
      : [];

    // if the authenticated user's like is not in the collection, return without doing anything
    if (!storedLikes.includes(userUid)) {
      return;
    }

    // cleans up the map of "like" event identifiers, keeping only the string values.
    const storedEventIds = readLikeEventIds(contentData.likeEventIds);

    // deletes the like event from the array
    const remainingEventIds = { ...storedEventIds };
    delete remainingEventIds[userUid];

    // Removing a like also clears its active event ID; historical notifications remain.
    // The transaction removes the UID's like and sets the likeEventIds map as the new remainingEventIds.
    transaction.update(contentReference, {
      likes: arrayRemove(userUid),
      likeEventIds: remainingEventIds,
    });
  });
}


// -----------------------------------------------------------------------------------------------------

/** Adds a comment with its author identity taken from Firebase and their profile. */
export async function addContentComment(contentType: LikeableContentType, 
                                        contentId: string, text: string): Promise<string> {

  if (!text.trim()) {
    throw new Error('Write a comment before posting it.');
  }

  const userUid = getSignedInUid();
  const profile = await getUserProfileByUid(userUid);

  if (!profile?.username) {
    throw new Error('Your public profile could not be found.');
  }

  // creates a reference to the 'comments' subcollection of the content the user is commenting on.
  const commentsCollection = collection(db, getContentCollection(contentType), contentId, 'comments');
  const commentReference = doc(commentsCollection);

  // Creates a reference and a snapshot of the specific content the user is commenting on.
  const contentReference = doc(db, getContentCollection(contentType), contentId);
  const contentSnapshot = await getDoc(contentReference);
  if (!contentSnapshot.exists()) {
    throw new Error('This content no longer exists.');
  }

  // `batch` allows to group multiple write operations and commit them all together.
  // the operations are performed atomically; either they are all committed, or none of them are applied.
  const batch = writeBatch(db);
  // adds an operation to the batch that will write the comment into the document identified by commentReference.
  // Includes the UID, the username, the text of the comment and the timestamp for the date.
  batch.set(commentReference, {
    userUid,
    username: profile.username,
    text,
    createdAt: serverTimestamp(),
  });

  
  // Creates and writes a notification for the targeted user (owner of the content).
  // Prevents a user from notifying themselves
  const authorUid = contentSnapshot.data().artistUid;
  if (typeof authorUid === 'string' && authorUid !== userUid) {
    // Creates the reference for the new notification
    const notificationId = `comment_${contentType}_${contentId}_${commentReference.id}`;
    const notificationReference = doc(db, 'notifications', notificationId);

    // Calls the notificationService's function to build the notification.
    // Batch is set to write the new notification as well.
    batch.set(
      notificationReference,
      buildContentNotificationData(
        'comment',
        userUid,
        profile.username,
        authorUid,
        contentType,
        contentId,
        commentReference.id,
        text
      )
    );
  }

  // Comment + notification is atomic in one single write.
  await batch.commit();

  // Returns the id of the new comment
  return commentReference.id;
}


// -------------------------------------------------------------------------------------------------------------

/** Deletes a user's comment, checks ownership before deleting; Firestore rules independently enforce it. */
export async function deleteContentComment(contentType: LikeableContentType,
                                            contentId: string, commentId: string): Promise<void> {

  const userUid = getSignedInUid();

  // creates the reference for the subcollection of comments in the specified content
  const commentReference = doc(
    db,
    getContentCollection(contentType),
    contentId,
    'comments',
    commentId
  );

  // Gets the document's snapshot
  const commentSnapshot = await getDoc(commentReference);
  if (!commentSnapshot.exists()) {
    throw new Error('This comment no longer exists.');
  }
  if (commentSnapshot.data().userUid !== userUid) {
    throw new Error('You can only delete your own comments.');
  }

  // Deletes the comment, which is a document in the collection
  await deleteDoc(commentReference);
}


// -----------------------------------------------------------------------------------------------------

/** This function is used in the custom hook useContentInteractions. It serves to listen for 'likes' on an 
 * artwork or a sprite in Firestore and communicate any updates to the React component that uses it. 
 * It takes a function that will be executed whenever the updated likes are received and a function 
 * to execute when there is an error.*/
export function subscribeToContentLikes(contentType: LikeableContentType, contentId: string,
                                        onLikesChanged: (likes: string[]) => void,
                                        onError: (error: Error) => void): Unsubscribe {
  
  
  const contentReference = doc(db, getContentCollection(contentType), contentId);

  // onSnapshot is a firebase function that "listens" to a document in real time.
  // The second parameter is a callback function executed when the document changes.
  // This latter function calls the function passed by the hook.
  return onSnapshot(contentReference, (contentSnapshot) => {
      // retrieves the snapshot and builds the array
      const storedLikes = contentSnapshot.data()?.likes;
      const likes = Array.isArray(storedLikes)
        ? storedLikes.filter((userUid): userUid is string =>
            typeof userUid === 'string'
          )
        : [];

      onLikesChanged(likes); // executes the function passed by the useEffect in the useContentInteractions hook
    },
    onError // takes the error function as a parameter as well
  );
}


// ---------------------------------------------------------------------------------------------------------------------

/** This function is used in the custom hook useContentInteractions. Serves the same purpose of the one above but
 * for comments, and has the same functionality and parameters.
*/
export function subscribeToContentComments(contentType: LikeableContentType,
                                            contentId: string,
                                            onCommentsChanged: (comments: ContentComment[]) => void,
                                            onError: (error: Error) => void
                                            ): Unsubscribe {
           
  // creates a reference to the 'comments' subcollection of the content the user is commenting on.                                            
  const commentsCollection = collection(
    db,
    getContentCollection(contentType),
    contentId,
    'comments'
  );

  // onSnapshot listens to the changes in that collection and reacts to it
  // by executing the function in the second parameter (which calls the function
  // passed by the hook, internally).
  return onSnapshot(commentsCollection, (commentsSnapshot) => {
      // This first map converts the documents received from Firestore into comment objects 
      // that the application can use, via mapCommentDocument().
      const comments = commentsSnapshot.docs.map((commentDocument) =>
        mapCommentDocument(commentDocument.id, commentDocument.data())
      );

      // now that we have the comments as objects, we can manipulate the object.
      /* This first map creates a temporary object for each comment, containing:
          - comment: the original comment;
          - originalIndex: the comment's original position in the array;
          - timestamp: the date converted into a number.*/
      const sortedComments = comments
        .map((comment, originalIndex) => ({
          comment,
          originalIndex,
          timestamp: Date.parse(comment.createdAt),
        }))
        // This temporary object is sorted by date, then sorts comments without a valid date,
        // and if two comments have the same date, keeps the original order.
        .sort((first, second) => {
          const firstHasDate = Number.isFinite(first.timestamp);
          const secondHasDate = Number.isFinite(second.timestamp);

          if (!firstHasDate && !secondHasDate) {
            return first.originalIndex - second.originalIndex;
          }

          if (!firstHasDate) return 1;
          if (!secondHasDate) return -1;

          return (
            first.timestamp - second.timestamp ||
            first.originalIndex - second.originalIndex
          );
        })
        // Now that this comments object is sorted, remove the temporary information added by the 
        // first map() needed to sort it, and retrieve only the comments, which are already sorted.
        .map((entry) => entry.comment); 

      // executes the function passed by the useContentInteractions hook: this function takes
      // the sortedComments object we just made, and sets the comments in the hook.
      onCommentsChanged(sortedComments);
    },
    onError // last parameter of the function onSnapshot
  );
}
