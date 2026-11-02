/**
 * Displays private Firestore notifications for the authenticated user.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../contexts/AuthContext';
import { getArtworkById } from '../services/artworkService';
import { getSpriteById } from '../services/spriteService';
import { getProjectById } from '../services/projectService';
import type {
  FirestoreNotification,
  NotificationContentType,
} from '../types/firestoreNotification';
import {
  getNotificationsForUser,
  markNotificationAsRead,
} from '../services/notificationService';

// -------------------------------------------------------------------------------------------------------

// UTILITY GETTERS

function getContentTitleKey(
  contentType: NotificationContentType,
  contentId: string
) {
  return `${contentType}:${contentId}`;
}

// Return a Firestore content title when available, or a readable type label.
function getContentTitle(notification: FirestoreNotification,
                        contentTitles: Record<string, string | null>): string {
  
  const contentId = notification.contentId ?? '';
  const contentType = notification.contentType;

  if (!contentType || !contentId) {
    return 'a content item';
  }

  const fallbackTitles: Record<NotificationContentType, string> = {
    artwork: 'an artwork',
    sprite: 'a sprite',
    project: 'a project',
  };

  return (
    contentTitles[getContentTitleKey(contentType, contentId)] ??
    fallbackTitles[contentType]
  );
}

// Returns the path to the content mentioned in a notification.
function getContentPath(
  notification: FirestoreNotification
): string {
  const contentId = notification.contentId ?? '';

  if (notification.contentType === 'artwork') {
    return `/artworks/${encodeURIComponent(contentId)}`;
  }

  if (notification.contentType === 'sprite') {
    return `/sprites/${encodeURIComponent(contentId)}`;
  }

  // Projects do not have individual detail pages yet.
  return '/projects';
}


// --------------------------------------------------------------------------------------------------

// COMPONENT

function NotificationsPage() {
  // Listens to the authentication context
  const authState = useAuth();
  const currentUid = authState.user?.uid;

  const [notifications, setNotifications] = useState<FirestoreNotification[]>([]);
  const [loadedRecipientUid, setLoadedRecipientUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isUpdatingReadStatus, setIsUpdatingReadStatus] = useState(false);
  const [contentTitles, setContentTitles] = useState<Record<string, string | null>>({});

  // Load notifications whenever the authenticated user changes.
  // calls the notification service.
  useEffect(() => {
    let isActive = true;

    async function loadNotifications() {
      if (authState.isLoading) {
        return;
      }

      if (!currentUid) {
        setNotifications([]);
        setLoadedRecipientUid(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      setLoadedRecipientUid(null);

      try {
        // notification service call
        const loadedNotifications = await getNotificationsForUser(currentUid);

        if (isActive) {
          setNotifications(loadedNotifications);
          setLoadedRecipientUid(currentUid);
        }
      } catch (error) {
        if (isActive) {
          // Log the original error so Firestore or data-conversion problems can be diagnosed.
          console.error('Failed to load notifications:', error);
          setErrorMessage(
            'Unable to load notifications. Please try again.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      isActive = false;
    };
  }, [currentUid, authState.isLoading]);

  // Never render a previous account's cached notifications while another UID is loading.
  const currentUserNotifications = loadedRecipientUid === currentUid ? notifications : [];


  // Retrieves the titles of the content items to which the notifications refer 
  // and saves them in the contentTitles state.
  // The notification contains the content type and ID, but its title is also needed 
  // to display a more readable message on the page.
  useEffect(() => {
    let isActive = true;
    const contentToLoad = new Map<string, { contentType: NotificationContentType; contentId: string }>();

    notifications.forEach((notification) => {
      const contentType = notification.contentType;
      const contentId = notification.contentId;

      if (!contentType || !contentId) {
        return;
      }

      const key = getContentTitleKey(contentType, contentId);
      if (!(key in contentTitles)) {
        contentToLoad.set(key, { contentType, contentId });
      }
    });

    // Definition of the function to load the titles
    async function loadContentTitles() {
      const loadedTitles = await Promise.all(
        [...contentToLoad.entries()].map(async ([key, content]) => {
          try {
            let title: string | undefined;

            if (content.contentType === 'artwork') {
              title = (await getArtworkById(content.contentId))?.title;
            } else if (content.contentType === 'sprite') {
              title = (await getSpriteById(content.contentId))?.title;
            } else {
              title = (await getProjectById(content.contentId))?.title;
            }

            return [key, title] as const;
          } catch (error) {
            console.error('Unable to load notification content title:', error);
            return [key, undefined] as const;
          }
        })
      );

      if (isActive) {
        // sets the content titles state
        setContentTitles((currentTitles) => {
          const nextTitles = { ...currentTitles };

          loadedTitles.forEach(([key, title]) => {
            // Remember missing titles too, so deleted content is not fetched repeatedly.
            nextTitles[key] = title ?? null;
          });

          return nextTitles;
        });
      }
    }

    if (contentToLoad.size > 0) {
      // loads the titles
      void loadContentTitles();
    }

    return () => {
      isActive = false;
    };
  }, [notifications, contentTitles]);

  
  // Count notifications that have not been read yet.
  const unreadCount = currentUserNotifications.filter((currentNotification) => !currentNotification.isRead).length;


  // ==========
  // HANDLERS
  // ==========

  // Handler for the "mark as read" button.
  // Persists the read status in firestore by calling notificationService,
  // before updating the interface.
  async function handleMarkAsRead(notificationId: string) {
    setErrorMessage('');

    try {
      // notificationService call
      await markNotificationAsRead(notificationId);

      // sets the state of notifications
      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notificationId
            ? { ...currentNotification, isRead: true }
            : currentNotification
        )
      );
    } catch {
      setErrorMessage(
        'Unable to update the notification. Please try again.'
      );
    }
  }


  // Mark every unread notification as read in Firestore.
  async function handleMarkAllAsRead() {
    const unreadNotifications = currentUserNotifications.filter(
      (currentNotification) => !currentNotification.isRead
    );

    if (unreadNotifications.length === 0) {
      return;
    }

    setErrorMessage('');
    setIsUpdatingReadStatus(true);

    try {
      await Promise.all(
        // for each notification, marks it as read in firestore
        unreadNotifications.map((currentNotification) =>
          markNotificationAsRead(currentNotification.id)
        )
      );

      // sets the state of all notifications marking them as read
      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) => ({
          ...currentNotification,
          isRead: true,
        }))
      );
    } catch {
      setErrorMessage(
        'Unable to mark all notifications as read. Please try again.'
      );
    } finally {
      setIsUpdatingReadStatus(false);
    }
  }


  // ====================
  // PAGE RENDERINGS
  // ====================

  if (authState.isLoading || isLoading) {
    return (
      <main className="main-content notifications-page">
        <header className="page-header">
          <h1>Notifications</h1>
        </header>
        <p className="section-description">Loading notifications...</p>
      </main>
    );
  }

  if (!currentUid) {
    return (
      <main className="main-content notifications-page">
        <header className="page-header">
          <h1>Notifications</h1>
        </header>
        <p className="section-description">
          Please log in to view your notifications.
        </p>
      </main>
    );
  }

  return (
    <main className="main-content notifications-page">
      <header className="page-header">
        <h1>Notifications</h1>
        <p className="section-description">
          See who followed, liked, and commented on your content.
        </p>
      </header>

      <div className="notifications-toolbar">
        <p>
          {unreadCount === 0
            ? 'You are all caught up.'
            : `${unreadCount} unread notification${
                unreadCount === 1 ? '' : 's'
              }`}
        </p>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={isUpdatingReadStatus}
          >
            {isUpdatingReadStatus
              ? 'Updating...'
              : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* Show the error only when loading or updating notifications failed. */}
      {errorMessage && (
        <p className="section-description" role="alert">
          {errorMessage}
        </p>
      )}

      {/* Show the empty state only after loading succeeds without an error. */}
      {!isLoading && !errorMessage && currentUserNotifications.length === 0 && (
        <p className="section-description">
          You do not have any notifications yet.
        </p>
      )}

      {currentUserNotifications.length > 0 && (
        <div className="notification-list">
          {currentUserNotifications.map((currentNotification) => (
            <article
              className={`notification ${
                currentNotification.isRead ? 'read' : 'unread'
              }`}
              key={currentNotification.id}
            >
              <div className="notification-body">
                <p>
                  <Link
                    to={`/profile/${encodeURIComponent(
                      currentNotification.actorUsername
                    )}`}
                    className="notification-actor"
                  >
                    @{currentNotification.actorUsername}
                  </Link>{' '}

                  {currentNotification.type === 'follow' ? (
                    'started following you.'
                  ) : (
                    <>
                      {currentNotification.type === 'like'
                        ? 'liked your'
                        : 'commented on your'}{' '}

                      {currentNotification.contentType ?? 'content'}{' '}

                      <Link
                        to={getContentPath(currentNotification)}
                        className="notification-content-link"
                      >
                        {getContentTitle(currentNotification, contentTitles)}
                      </Link>
                      .
                    </>
                  )}
                </p>

                {currentNotification.type === 'comment' &&
                  currentNotification.commentText && (
                    <blockquote className="notification-comment">
                      {currentNotification.commentText}
                    </blockquote>
                  )}

                <time dateTime={currentNotification.createdAt}>
                  {new Date(
                    currentNotification.createdAt
                  ).toLocaleString()}
                </time>
              </div>

              {!currentNotification.isRead && (
                <button
                  type="button"
                  className="notification-read-button"
                  onClick={() =>
                    void handleMarkAsRead(currentNotification.id)
                  }
                  aria-label={`Mark notification from ${currentNotification.actorUsername} as read`}
                >
                  Mark as read
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default NotificationsPage;
