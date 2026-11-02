/** Provides the client-side Firebase Cloud Messaging integration. */
import type { MessagePayload } from 'firebase/messaging';
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
  onMessage,
} from 'firebase/messaging';
import firebaseApp from './firebase';

// -------------------------------------------------------------------------------------------------------------------

// Retrieve the VAPID public key from the project's environment variables and verify 
// that it has been configured correctly.
function getVapidPublicKey(): string {
  const vapidPublicKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();

  if (!vapidPublicKey || vapidPublicKey === 'replace-with-public-vapid-key') {
    throw new Error(
      'Push notifications are not configured. Add the Firebase public VAPID key to .env.local and restart Vite.'
    );
  }

  return vapidPublicKey;
}

// -------------------------------------------------------------------------------------------------------------------

// Utility: calls FCM's isSupported function to check if push notifications are supported in the browser
export async function isPushMessagingSupported(): Promise<boolean> {

  // fails if the window doesn't exist, or if the browser doesn't
  // support notification APIs or serviceWorkers
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return false;
  }

  try {
    return await isSupported();
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------------------------------------------

// Enables push notifications. This function is called in pushNotificationsButton.
export async function enablePushNotifications(): Promise<string> {

  // checks if they are supported
  if (!(await isPushMessagingSupported())) {
    throw new Error(
      'Push notifications are not supported in this browser or browsing context. Use a supported browser over HTTPS.'
    );
  }

  // Gets the vapid key and checks the permission from the browser
  const vapidKey = getVapidPublicKey();
  let permission = Notification.permission;

  // Various checks on the permissions for push notifications. If on 'default', requests
  // the permission manually.
  if (permission === 'denied') {
    throw new Error(
      'Notifications are blocked for this site. Change the site notification permission in your browser settings, then try again.'
    );
  }
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error(
      'Notification permission was not granted. Allow notifications in the browser prompt to enable push.'
    );
  }

  // Verify if there is a registered service worker
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (!existingRegistration) {
    throw new Error(
      'Pixeling’s service worker is not available here. Open the installed app or its HTTPS site and try again.'
    );
  }

  // If there is a service worker, 
  // tries to get the token for push notifications from FCM
  try {
    // wait the service worker to be ready (returns a promise resolved when the sw is ready)
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(firebaseApp), {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      throw new Error('No registration token was returned.');
    }

    // Returns the FCM token. This token can be copied to send a push notification from FCM manually.
    return token;

  } catch {
    throw new Error(
      'Pixeling could not obtain an FCM token. Check the connection, Firebase Cloud Messaging setup, and VAPID public key.'
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------------------

// Disables push notifications by deleting the token from firebase (see use in pushNotificationsButton).
export async function disablePushNotifications(): Promise<void> {
  if (!(await isPushMessagingSupported())) {
    throw new Error('Push notifications are not supported here.');
  }

  // FCM's function
  await deleteToken(getMessaging(firebaseApp));
}

// --------------------------------------------------------------------------------------------------------------------------

// listen for push messages received while the Pixeling application is open and active in the browser.
// Takes a listener as a parameter (a function executed when a push message arrives, that takes the message's
// payload as a parameter) and returns a Promise that, when resolved, returns a function without parameters 
// or return value (which is the type of the FCM's function called).
export async function subscribeToForegroundMessages(listener: (payload: MessagePayload) => void
                                                    ): Promise<() => void> {
  if (!(await isPushMessagingSupported())) {
    throw new Error('Foreground push messages are not supported here.');
  }

  // FCM's onMessage function listens to messages while the app is in foreground
  return onMessage(getMessaging(firebaseApp), listener);
}

