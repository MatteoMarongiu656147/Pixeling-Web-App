/** 
 * Lets authenticated users enable, disable, and test Firebase Cloud Messaging. 
*/
import { useEffect, useRef, useState } from 'react';
import type { MessagePayload } from 'firebase/messaging';
import {
  enablePushNotifications,
  disablePushNotifications,
  isPushMessagingSupported,
  subscribeToForegroundMessages,
} from '../services/messagingService';

// This value is used as a key to save the user's preference in the browser's localStorage.
// If true, it means the user doesn't want push notifications, and viceversa.
const PUSH_DISABLED_STORAGE_KEY = 'pixeling-push-disabled';

// The component uses the functions available from the messagingService.ts.
function PushNotificationButton() {

  // States for the re-rendering of the button regard the notifications.
  // Are they enabling/enabled or not, are they supported, etc
  // This also includes the notification token for FCM when it's available
  const [isEnabling, setIsEnabling] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');

  // This ref is used for security/functionality checks in the functions (e.g. see handleToggleNotifications below).
  // setIsEnabling(true) updates the interface. the button is disabled, and a loading icon may appear.
  // isEnablingRef.current = true immediately updates a value that can be used as a block 
  // against further calls.
  const isEnablingRef = useRef(false);


  // Executed when the component is mounted. Checks notification support.
  // If it is not supported, restores the previous configuration.
  useEffect(() => {

    // used for security checks before doing asynchronous operations
    // (the component may be unmounted while waiting an answer)
    let isActive = true;

    async function checkSupportAndRestorePermission() {
      try {
        const supported = await isPushMessagingSupported();

        // prevents the state from being updated if the component has been unmounted or the
        // effect has been invalidated while the check was in progress.
        if (!isActive) return;

        setIsSupported(supported);

        if (
          !supported || // notifications are not supported
          localStorage.getItem(PUSH_DISABLED_STORAGE_KEY) === 'true' || // the user toggled off the notifications
          Notification.permission !== 'granted' // notifications are not allowed by the browser
        ) {
          return; // exits from the effect and prevents the push notifications to be enabled
        }


        // Starts enabling push notifications and retrieves the FCM token.
        isEnablingRef.current = true;
        setIsEnabling(true);
        const token = await enablePushNotifications();

        // Prevent updating the state if the component has been unmounted while waiting for the
        // asynchronous operation (avoid updating the state after a no longer valid operation)
        if (isActive) {
          setRegistrationToken(token);
          setIsEnabled(true);
        }
      } catch (error) {
        if (isActive) {
          setStatusMessage(
            error instanceof Error
              ? error.message
              : 'Unable to restore push notifications on this device.'
          );
        }
      } finally {
        // end the enabling/loading state of the component and "free" the ref
        isEnablingRef.current = false;
        if (isActive) {
          setIsEnabling(false);
        }
      }
    }

    // execute the defined function
    void checkSupportAndRestorePermission();

    // on cleanup: invalidates the current operation
    return () => {
      isActive = false;
    };
  }, []);


  // Listens to the push messages while the app is open.
  // executed whenever the isEnabled state for notifications has changed
  useEffect(() => {

    // If notifications are not enabled, doesn't do anything
    if (!isEnabled) return;

    let isActive = true; // same meaning as the isActive in the first useEffect
    let unsubscribe: (() => void) | undefined; // executed on the cleanup. Undefined when notifications are disabled.

    // Shows the notification's payload
    function showForegroundMessage(payload: MessagePayload) {
      const title =
        payload.notification?.title ??
        payload.data?.title ??
        'New Pixeling message'; // default title for notifications

      const body = payload.notification?.body ?? payload.data?.body;

      if (isActive) {
        // shows the message while the app is open (not in background)
        setStatusMessage(body ? `${title}: ${body}` : title);
      }
    }

    // calls the messagingService function.
    // Listen for notifications. When you receive one, call the function to show it
    // (showForegroundMessage) and pass the content of the notification to it.
    // The messagingService returns a function that interrupts the listening (stopListening),
    // the component saves it into the unsubscribe variable.
    void subscribeToForegroundMessages(showForegroundMessage).then((stopListening) => {

        if (isActive) {
          unsubscribe = stopListening;
        } else {
          stopListening();
        }
      })
      .catch(() => {
        if (isActive) {
          setStatusMessage(
            'Push is enabled, but foreground messages could not be initialized.'
          );
        }
    });

    // cleanup
    return () => {
      isActive = false;
      unsubscribe?.(); // if unsubscribe exists, call it
    };

  }, [isEnabled]); // executed when the isEnabled state changes


  // This is the function executed by the toggle push notifications button
  async function handleToggleNotifications() {

    // If an operation is already in progress, or if notifications are not supported,
    // the function terminates immediately
    if (isEnablingRef.current || isSupported !== true) return;

    isEnablingRef.current = true;
    setIsEnabling(true);
    setStatusMessage('');

    try {

      // If notifications are already enabled, the button will disable them
      if (isEnabled) {
        await disablePushNotifications(); // FCM deletes the token

        localStorage.setItem(PUSH_DISABLED_STORAGE_KEY, 'true');
        setIsEnabled(false);
        setRegistrationToken(''); // deletes the token from the app
        setStatusMessage('');

      // If they are not enabled, the button enables the push notifications  
      } else {
        const token = await enablePushNotifications(); // FCM creates a token

        localStorage.removeItem(PUSH_DISABLED_STORAGE_KEY); // removes the user's preference to disable push not.
        setRegistrationToken(token); // gets the token in the app
        setIsEnabled(true);
        setStatusMessage('');
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update push notification settings.'
      );
    } finally {
      isEnablingRef.current = false;
      setIsEnabling(false);
    }
  }

  
  // Used by the copy button to copy the FCM token
  async function copyRegistrationToken() {
    try {
      await navigator.clipboard.writeText(registrationToken);
      setStatusMessage('Token copied.');
    } catch {
      setStatusMessage(
        'Could not copy the token. Use the option below to select it manually.'
      );
    }
  }

  
  
  return (
    <div>
      <div className="push-notification-actions">
        <button
          type="button"
          className="push-icon-button"
          onClick={() => void handleToggleNotifications()}
          disabled={isSupported !== true || isEnabling}
          aria-pressed={isEnabled}
          aria-label={
            isEnabling
              ? 'Updating push notifications'
              : isEnabled
                ? 'Disable push notifications'
                : isSupported === false
                  ? 'Push notifications unavailable'
                  : 'Enable push notifications'
          }
          title={
            isEnabling
              ? 'Updating...'
              : isEnabled
                ? 'Disable push notifications'
                : 'Enable push notifications'
          }
        >
          {isEnabling ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray="42 15"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 21h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {isEnabled && (
                <path
                  d="m16 4 2 2 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          )}
        </button>

        {isEnabled && registrationToken && (
          <button
            type="button"
            className="push-icon-button"
            onClick={() => void copyRegistrationToken()}
            aria-label="Copy FCM token"
            title="Copy FCM token"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect
                x="8"
                y="8"
                width="12"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {isSupported === false && (
        <span role="status">
          Push notifications are not supported in this browser or context.
        </span>
      )}

      {statusMessage && <span role="status">{statusMessage}</span>}
    </div>
  );


}

export default PushNotificationButton;
