
/**
 * Displays the public or authenticated navigation bar.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { logOutUser } from '../../services/authService';
import { getUserProfileByUid } from '../../services/userProfileService';
import type { UserProfile } from '../../types/UserProfile';

import PushNotificationButton from '../pushNotificationsButton'

// The Navbar changes when a user is logged in or not
type NavbarProps = {
  isLoggedIn: boolean;
}

function Navbar(props: NavbarProps) {
  const isLoggedIn = props.isLoggedIn;

  // Needed to keep track of the authentication status. 
  // Used to extract the user's id and check if the registration is in progress
  // (see the useEffect below).
  const authState = useAuth();

  // Needed to change the pages
  const navigate = useNavigate();

  // Re-rendering when these properties change
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isProfileMissing, setIsProfileMissing] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);

  const currentUid = authState.user?.uid;

  // useEffect: loads the actual username from the Firestore profile.
  // Handles possible problems during the loading.
  // Executed when: 
  // - The UID is changed
  // - the user retries to load the profile
  // - the registration status changed
  useEffect(() => {

    let isActive = true; // is the effect still active/valid
    let timeoutId: number | undefined; // to identify the timer

    // internal function to load the username
    async function loadUsername() {
      setCurrentUsername('');
      setProfileError('');
      setIsProfileMissing(false);

      // If there is no UID, or if the registration process is still underway, 
      // the loading process is halted.
      // During registration, Firebase Authentication might have already created the user, 
      // while their Firestore profile may not yet have been written. 
      // Waiting prevents a lookup from being attempted too early.
      if (!currentUid || authState.isRegistrationInProgress) {
        setIsLoadingProfile(false);
        return;
      }

      // Sets the loading profile state
      setIsLoadingProfile(true);

      try {

        // After 15 seconds throws an error.
        const timeout = new Promise<never>((_resolve, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error('profile-read-timeout')),
            15000
          );
        });

        // Try to retrieve the user. Race between the timeout and the userProfile.
        // After both of the promises, clears the timeout window and timer ID.
        let userProfile: UserProfile | null;
        try {
          userProfile = await Promise.race([
            getUserProfileByUid(currentUid),
            timeout,
          ]);
        } finally {
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            timeoutId = undefined;
          }
        }

        // If the effect is no longer active, it does not update the state.
        if (!isActive) {
          return;
        }

        /* - If the profile exists, it saves the username.
        - If the search returns null, it indicates that the profile is missing.*/
        if (userProfile) {
          setCurrentUsername(userProfile.username);
        } else {
          setIsProfileMissing(true);
        }
        // If an error occurs, it enters the catch block and displays a message that 
        // allows the user to retry.
      } catch (error) {
        if (isActive) {
          console.error('Failed to load the authenticated user profile:', error);
          setProfileError('Unable to load your profile link. Please retry.');
        }
        // Sets `isLoadingProfile` to `false`, so the Navbar knows that the loading process 
        // has finished—whether it was successful or resulted in an error.
      } finally {
        if (isActive) {
          setIsLoadingProfile(false);
        }
      }
    }

    // useEffect loads the username.
    void loadUsername();

    // cleanup function
    return () => {
      isActive = false;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [currentUid, profileRetry, authState.isRegistrationInProgress]);


  // changes the profileRetry state counter (so the useEffect will be executed again)
  function retryProfileLookup() {
    setProfileRetry((retryCount) => retryCount + 1);
  }

  // URL of the loaded profile
  const profileDestination = currentUsername
    ? `/profile/${encodeURIComponent(currentUsername)}`
    : '/';

  
  // The logo button will redirect to the homepage if you are logged,
  // or to the initial page if you are not logged
  const logoDestination = isLoggedIn ? '/home' : '/';

  // This logout function is executed by the logout button
  async function handleLogout() {
    setErrorMessage('');
    try {
      await logOutUser();
      navigate('/');
    } catch {
      setErrorMessage('Unable to log out. Please try again.');
    }
  }



  // The Navbar changes whether you are logged in or not.
  return (
    <nav className="navbar" aria-label="Main navigation">
      
      <Link
        className="logo"
        to={logoDestination}
        aria-label="Pixeling - Home"
      >
        <img
          src="/PixelingLogo.png"
          alt=""
          className="navbar-logo-image"
        />
      </Link>


      {isLoggedIn ? (
        <div className="nav-links">
          <PushNotificationButton />

          <Link
            to="/home"
            className="nav-icon-link"
            aria-label="Home"
            title="Home"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 10 9-7 9 7" />
              <path d="M5 9v12h14V9M9 21v-7h6v7" />
            </svg>
          </Link>

          <Link
            to="/search"
            className="nav-icon-link"
            aria-label="Search"
            title="Search"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
          </Link>

          <Link
            to="/notifications"
            className="nav-icon-link"
            aria-label="Notifications"
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </Link>

          {currentUsername ? (
            <Link
              to={profileDestination}
              className="nav-icon-link"
              aria-label="My profile"
              title="My profile"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </Link>
          ) : isLoadingProfile ? (
            <span aria-live="polite">Loading...</span>
          ) : profileError ? (
            <span aria-live="polite" role="alert">
              {profileError}{' '}
              <button type="button" onClick={retryProfileLookup}>
                Retry
              </button>
            </span>
          ) : isProfileMissing ? (
            <span aria-live="polite" role="alert">
              Profile not found.{' '}
              <button type="button" onClick={retryProfileLookup}>
                Retry
              </button>
            </span>
          ) : (
            <span aria-live="polite">Profile unavailable.</span>
          )}

          <button
            type="button"
            className="nav-icon-link nav-logout"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="nav-links">
          <Link to="/signin">Sign in</Link>
          <Link to="/login">Log in</Link>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="auth-error">
          {errorMessage}
        </p>
      )}
    </nav>
  );

}

export default Navbar;
