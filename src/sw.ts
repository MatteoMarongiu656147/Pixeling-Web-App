/** 
 * Service Worker:
 * 1) Handles Service Worker updates.
 * 2) Handles notification clicks and opens the correct Pixeling page.
 * 3) Receives push notifications via Firebase Cloud Messaging (FCM).
 * 4) Handles navigation requests, displaying an offline page if the network is unavailable.
 * */

import { initializeApp } from 'firebase/app';

import {
  getMessaging,                        // Retrieves the Firebase Messaging instance associated with the Firebase app.
  isSupported as isMessagingSupported, // Check whether Firebase Messaging is supported in the current environment.
  onBackgroundMessage,                 // registers a function that is executed when a push notification arrives while the app 
                                       // is in background.
} from 'firebase/messaging/sw';

// Workbox imports are used to precache static application assets and retrieve cached resources when needed.
import { matchPrecache, precacheAndRoute } from 'workbox-precaching';

import firebaseConfig from './services/firebaseConfig';

// --------------------------------------------------------------------------------------

/**
 * Extends the global WorkerGlobalScope interface to include
 * the Workbox precache manifest.
 * The manifest contains the URLs and optional revision identifiers
 * of the static assets that must be precached.
 */
declare global {
  interface WorkerGlobalScope {
    __WB_MANIFEST: Array<string | { revision?: string | null; url: string }>;
  }
}

// --------------------------------------------------------------------------------------
// structure of the objects and events that will be used/listened by the service worker

/**
 * Defines the structure of a navigation fetch event.
 * Extends the standard Event type with the request being handled
 * and the respondWith method used to provide a custom response.
 */
type NavigationFetchEvent = Event & {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
};

/**
 * Defines the structure of an extendable Service Worker event.
 * Extends the standard Event type with waitUntil(), which allows
 * the browser to keep the Service Worker alive until an asynchronous
 * operation has completed.
 */
type ExtendableWorkerEvent = Event & {
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Defines the properties and methods of a Pixeling browser window client.
 * The URL identifies the currently opened page, navigate() changes
 * the destination, and focus() brings the window to the foreground.
 */
type PixelingWindowClient = {
  url: string;
  focus(): Promise<unknown>;
  navigate(url: string): Promise<PixelingWindowClient | null>;
};

/**
 * Defines the Service Worker's properties and methods that will be used.
 * Extends WorkerGlobalScope with the clients API, registration,
 * and skipWaiting() methods needed to manage browser windows,
 * notifications, and the Service Worker lifecycle.
 */
type PixelingServiceWorkerScope = WorkerGlobalScope & {
  clients: {
    claim(): Promise<void>;
    matchAll(options: {
      type: 'window';
      includeUncontrolled: boolean;
    }): Promise<PixelingWindowClient[]>;
    openWindow(url: string): Promise<PixelingWindowClient | null>;
  };
  registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
};

/**
 * Defines the structure of a notification click event.
 * Extends ExtendableWorkerEvent with the notification object,
 * allowing access to the clicked notification and its custom data.
 */
type NotificationClickEvent = ExtendableWorkerEvent & {
  notification: Notification;
};

// -----------------------------------------------------------------------------------------------------

// serviceWorker contains a reference to the Service Worker's global context (self).
// Presents it to TypeScript using the custom type PixelingServiceWorkerScope.
const serviceWorker = self as unknown as PixelingServiceWorkerScope;

// Initialize Firebase within the Service Worker context.
// this Firebase instance is not the same used elsewhere in the react application,
// and it's used by the service worker to obtain Firebase Cloud Messaging services.
const firebaseWorkerApp = initializeApp(firebaseConfig);

// ----------------------------------------------------------------------------------------------------------------


// When an update is available, the browser sends a message with type SKIP_WAITING.
// this message is intercepted by this event listener.
serviceWorker.addEventListener('message', (event) => {
  const messageEvent = event as MessageEvent<{ type?: string }>;

  // tells the browser to skip the "waiting" state and immediately activate 
  // the new Service Worker, taking control of the page without the need to close and reopen the browser.
  if (messageEvent.data?.type === 'SKIP_WAITING') {
    (event as ExtendableWorkerEvent).waitUntil(serviceWorker.skipWaiting());
  }
});


// The activate event is emitted by the browser when the Service Worker enters the activation phase.
// Immediately takes control of all open tabs for the site, without the user needing to reload the page.
serviceWorker.addEventListener('activate', (event) => {
  (event as ExtendableWorkerEvent).waitUntil(serviceWorker.clients.claim());
});


// Utility function to sanitize and validate a path (URL), ensuring that it is 
// secure and belongs to the same domain as the web application.
// Used in the next event listener.
function getSafePixelingPath(candidate?: string): string {
  try {
    const destination = new URL(candidate || '/', serviceWorker.location.origin);
    if (destination.origin !== serviceWorker.location.origin) return '/';
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return '/';
  }
}


// This event listener handles what happens when a user clicks on a push notification sent to the app.
// Instead of blindly opening a new window every time, it checks whether the app is already open 
// in a browser tab—reusing it (by bringing it into focus) — or opens a new one if necessary.
serviceWorker.addEventListener('notificationclick', (event) => {
  const clickEvent = event as NotificationClickEvent;

  // contains the internal app page to which the user should be redirected
  const destination = clickEvent.notification.data?.pixelingPath;

  if (typeof destination !== 'string') return;

  event.stopImmediatePropagation();
  clickEvent.notification.close(); // notification disappears from display
  clickEvent.waitUntil(
    (async () => {
      // builds the redirect url
      const safePath = getSafePixelingPath(destination);
      const safeUrl = new URL(safePath, serviceWorker.location.origin).href;
      // It requests the list of all open tabs from the browser (matchAll) 
      // and checks (finds) whether any of them belong to the same domain as your site.
      const clients = await serviceWorker.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const existingClient = clients.find((client) => {
        try {
          return new URL(client.url).origin === serviceWorker.location.origin;
        } catch {
          return false;
        }
      });

      // If an existing tab is found (existingClient): Instead of opening an intrusive new tab, 
      // it navigates the existing one to the new URL (safeUrl) and brings it to the foreground (focus()).

      // If no open tab is found: It opens a new browser window/tab, 
      // pointing it directly to that address (openWindow(safeUrl)).

      if (existingClient) {
        const navigatedClient = await existingClient.navigate(safeUrl);
        await (navigatedClient ?? existingClient).focus();
      } else {
        await serviceWorker.clients.openWindow(safeUrl);
      }
    })()
  );
});


// Function that initializes and handles push notification reception with FCM 
async function initializeBackgroundMessaging() {

  // return immediately if push notifications are not supported
  if (!(await isMessagingSupported())) return;

  // Calls FCM
  const messaging = getMessaging(firebaseWorkerApp);

  // listens for messages sent by FCM when the web page is not in foreground.
  onBackgroundMessage(messaging, async (payload) => {
    // If the Firebase message already contains a standard notification structure, Firebase handles 
    // it automatically, and the function stops there. If it is a data-only message, the function 
    // continues in order to handle it manually.
    if (payload.notification) return;

    // Gets title and body of the message
    const title = payload.data?.title || 'Pixeling notification';
    const body = payload.data?.body || 'You have a new message.';

    // Shows the notification
    await serviceWorker.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      data: {
        pixelingPath: getSafePixelingPath(payload.data?.link),
      },
    });
  });
}

// call the function to handle push notifications
void initializeBackgroundMessaging().catch(() => {
  console.error('Firebase Messaging background setup failed.');
});


// Handles navigation requests (when the user opens a page, clicks a link, or refreshes the browser) 
// and attempts to download the updated page from the internet. If the user is offline, it displays a fallback page.
serviceWorker.addEventListener('fetch', (event) => {
  const fetchEvent = event as NavigationFetchEvent;
  const { request } = fetchEvent;
  const requestUrl = new URL(request.url);

  // respond only if it's a navigate request and the requested page is in the
  // same domain of of the app (ignores external links)
  if (
    request.mode !== 'navigate' ||
    requestUrl.origin !== serviceWorker.location.origin
  ) {
    return;
  }

  fetchEvent.respondWith(
    (async () => {
      try {
        // Don't use cache, download the latest version of the page.
        return await fetch(request, { cache: 'no-store' });
      } catch {
        // Show the offline fallback page.
        return (await matchPrecache('/offline.html')) ?? Response.error();
      }
    })()
  );
});

// ----------------------------------------------------------------------------------------------------------

// precacheAndRoute() is a workbox call that ensures that Workbox can serve resources directly from the cache 
// when the browser requests them (avoids mistakes like getting them from the internet even if they are in cache).
precacheAndRoute(self.__WB_MANIFEST);