/** Reads private notifications and builds the shared Firestore notification payloads. */

// THIS SERVICE DOES NOT REGARD PUSH NOTIFICATIONS.
// It's the service for in-app notifications for likes, follows and comments.

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';

import { db } from './firebase';
import type {
  FirestoreNotification,
  FirestoreNotificationType,
  NotificationContentType,
} from '../types/firestoreNotification';

// ---------------------------------------------------------------------------------------------------------------------

// This type defines the data structure used when creating notifications in Firestore.
// It is based on FirestoreNotification, excluding the document ID and
// replacing createdAt with a Firestore server timestamp.
// Used by notification data builders to ensure consistent fields
// across different notification types (see buildFollowNotificationData and buildContentNotificationData).

// "Omit" in typescript means "take FirestoreNotification as a type, and remove id and createdAt".
// Then it inserts a new createdAt, of type FieldValue (which is a firestore type).
type NotificationWriteData = Omit<FirestoreNotification, 'id' | 'createdAt'> & {
  createdAt: FieldValue;
};

// -----------------------------------------------------------------------------------------------------------------

// Determines if the notification is of content type (like or comment) and returns the type of content
// the notification was emitted to (artwork, sprite, or project)
function isNotificationContentType(value: unknown): value is NotificationContentType {
  return value === 'artwork' || value === 'sprite' || value === 'project';
}

// -----------------------------------------------------------------------------------------------------------------

// These builders are used to build the firestore notification records.
// They are used in likeAndCommentService, when a like or a comment occurs,
// to build and record the notification in firestore atomically when a like/comment/follow happens.

// Notifications for follows
export function buildFollowNotificationData(actorUid: string, actorUsername: string, 
                                            recipientUid: string): NotificationWriteData {

  return {
    recipientUid, // who receives the notification
    actorUid, // who "sends" it
    actorUsername, // username of the user who "sends" it
    type: 'follow',
    isRead: false,
    createdAt: serverTimestamp(),
  };
}

// Notifications for like and comments in artworks or sprites
export function buildContentNotificationData(type: Extract<FirestoreNotificationType, 'like' | 'comment'>,
                                              actorUid: string,
                                              actorUsername: string,
                                              recipientUid: string,
                                              contentType: Extract<NotificationContentType, 'artwork' | 'sprite'>,
                                              contentId: string,
                                              commentId?: string,
                                              commentText?: string
                                            ): NotificationWriteData {

  return {
    recipientUid, // who receives the notification
    actorUid, // who "sends" it
    actorUsername, // username of the user who "sends" it
    type,
    contentType,
    contentId,
    // if commentId and commentText exist, insert them
    ...(commentId ? { commentId } : {}),
    ...(commentText ? { commentText } : {}),
    isRead: false,
    createdAt: serverTimestamp(),
  };
}

// -------------------------------------------------------------------------------------------------------------

// Utility function: Convert and validate a document read from Firestore, transforming it into a 
// FirestoreNotification object that can be used by the application.
function mapNotificationDocument(notificationId: string,
                                  notificationData: Record<string, unknown>
                                ): FirestoreNotification | null {


  const { recipientUid, actorUid, actorUsername, type, isRead } = notificationData;
  const rawCreatedAt = notificationData.createdAt;
  let createdAt = '';

  try {
    if (rawCreatedAt instanceof Timestamp) {
      createdAt = rawCreatedAt.toDate().toISOString();
    } else if (
      typeof rawCreatedAt === 'string' ||
      typeof rawCreatedAt === 'number'
    ) {
      const parsedDate = new Date(rawCreatedAt);
      if (Number.isFinite(parsedDate.getTime())) {
        createdAt = parsedDate.toISOString();
      }
    }
  } catch {
    // A malformed legacy date is skipped below without breaking other records.
  }

  // Ignore malformed records individually so one legacy document cannot break the list.
  if (
    typeof recipientUid !== 'string' ||
    typeof actorUid !== 'string' ||
    typeof actorUsername !== 'string' ||
    (type !== 'follow' && type !== 'like' && type !== 'comment') ||
    typeof isRead !== 'boolean' ||
    !Number.isFinite(Date.parse(createdAt))
  ) {
    return null;
  }

  if (type !== 'follow') {
    const { contentType, contentId } = notificationData;
    if (
      !isNotificationContentType(contentType) ||
      typeof contentId !== 'string'
    ) {
      return null;
    }
  }

  return {
    id: notificationId,
    recipientUid,
    actorUid,
    actorUsername,
    type,
    ...(isNotificationContentType(notificationData.contentType)
      ? { contentType: notificationData.contentType }
      : {}),
    ...(typeof notificationData.contentId === 'string'
      ? { contentId: notificationData.contentId }
      : {}),
    ...(typeof notificationData.commentId === 'string'
      ? { commentId: notificationData.commentId }
      : {}),
    ...(typeof notificationData.commentText === 'string'
      ? { commentText: notificationData.commentText }
      : {}),
    createdAt,
    isRead,
  };
}

// -------------------------------------------------------------------------------------------

// This method uses firestore to retrieve the notifications of a recipient UID's user.
// The query is scoped by recipient UID, matching the private-read Firestore rule.
export async function getNotificationsForUser(recipientUid: string): Promise<FirestoreNotification[]> {

  // References the collection of notifications and queries all its documents
  // where the recipientUid is equal to the one passed to the function
  const notificationsCollection = collection(db, 'notifications');
  const notificationsQuery = query(
    notificationsCollection,
    where('recipientUid', '==', recipientUid)
  );
  // creates the snapshot of the documents received from the query
  const notificationsSnapshot = await getDocs(notificationsQuery);
 
  // Maps the docs received by converting them into an object (see mapNotificationDocument)
  // then filters it to extract only the valid data
  const notifications = notificationsSnapshot.docs
    .map((notificationDocument) =>
      mapNotificationDocument(
        notificationDocument.id,
        notificationDocument.data()
      )
    )
    .filter(
      (notification): notification is FirestoreNotification =>
        notification !== null && notification.recipientUid === recipientUid
    );

  // The first map adds temporary data used to sort the notifications
  return notifications
    .map((notification, originalIndex) => ({
      notification,
      originalIndex,
      timestamp: Date.parse(notification.createdAt),
    }))
    .sort(
      (first, second) =>
        second.timestamp - first.timestamp ||
        first.originalIndex - second.originalIndex
    )
    // the second map removes the additional data and keeps the notifications sorted
    .map(({ notification }) => notification);
}

// ---------------------------------------------------------------------------------------------------

// Marks a notification as read in firestore.
// Firestore rules allow recipients to update only their own read flag.
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  // gets the reference of the doc in firestore and updates it.
  const notificationReference = doc(db, 'notifications', notificationId);
  await updateDoc(notificationReference, { isRead: true });
}
