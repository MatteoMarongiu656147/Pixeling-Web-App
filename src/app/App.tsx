/**
 * Defines the shared application layout.
 */
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';

import './App.css';

function App() {
  // useAuth is needed for authentication (will be passed to the Navbar component as a prop)
  const authState = useAuth();

  // This state tracks the offline/online state of the app.
  // When offline, the app will show the custom offline layout.
  // The first state is assigned by navigator.onLine which determines if we are online or not.
  const [connectionState, setConnectionState] = useState<
    'online' | 'offline' | 'restored'
  >(() => (navigator.onLine ? 'online' : 'offline'));

  // Registers two listeners (one for offline and one for online)
  // Executed when the app component is mounted. The listeners remain active.
  useEffect(() => {
    function handleOffline() {
      setConnectionState('offline');
    }

    function handleOnline() {
      setConnectionState((currentState) =>
        currentState === 'offline' ? 'restored' : 'online'
      );
    }

    // Reacts to the events from the browser.
    // When the browser tells we are offline or online, change the state using the handlers.
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // cleanup: removes event listeners
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Return the offline layout if the connection state is offline.
  // The offline.html page is used by the service worker instead, for failed offline page loading.
  // When we lose connection while the app is running, this layout will be shown.
  // When we reload the page while we are already offline, the sw will show the fallback offline.html.
  if (connectionState !== 'online') {

    const connectionWasRestored = connectionState === 'restored'; // boolean

    return (
      <main className="offline-screen" aria-labelledby="offline-title">
        <section className="offline-card">
          <img
            className="offline-illustration"
            src="/NoConnection.png"
            alt=""
            aria-hidden="true"
            width="320"
            height="320"
          />
          <h1 id="offline-title">
            {connectionWasRestored ? 'Connection restored' : 'You’re offline'}
          </h1>
          <p role="status">
            {connectionWasRestored
              ? 'Reload Pixeling to continue. Any action that was in progress may not have completed; check its result after reconnecting.'
              : 'Pixeling can’t reach the Internet right now. Loading content and social actions need a connection. Any action already in progress may not have completed.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            disabled={!connectionWasRestored}
          >
            {connectionWasRestored ? 'Reload Pixeling' : 'Waiting for connection…'}
          </button>
        </section>
      </main>
    );
  }

  // Default application when connection is established
  // Navbar + Outlet decided by the React Router
  // Passes the authentication state to the Navbar as a prop
  return (
    <div className="app">
      <Navbar isLoggedIn={authState.isLoggedIn} />
      <Outlet />
    </div>
  );
}

export default App;
