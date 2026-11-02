
/**
 * Defines notifications stored in Firestore for authenticated users.
 * THIS IS NOT A PUSH NOTIFICATION.
 */

export type FirestoreNotificationType = 'follow' | 'like' | 'comment';

export type NotificationContentType = 'artwork' | 'sprite' | 'project';

export type FirestoreNotification = {
  id: string;
  recipientUid: string;
  actorUid: string;
  actorUsername: string;
  type: FirestoreNotificationType;
  contentType?: NotificationContentType;
  contentId?: string;
  commentId?: string;
  commentText?: string;
  createdAt: string;
  isRead: boolean;
};
