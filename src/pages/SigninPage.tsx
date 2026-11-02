/**
 * Displays the registration form for new users.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SubmitEvent } from 'react';
import '../app/App.css';
import { useAuth } from '../contexts/AuthContext';
import {
  recoverRegistrationProfile,
  registerUserWithProfile,
  RegistrationError,
} from '../services/authService';

// --------------------------------------------------------------------------------------------------

function SigninPage() {
  // Navigates to the home page after a successful sign in
  const navigate = useNavigate();
  // Listens to the authentication context
  const authState = useAuth();

  // keeps a direct reference to the HTML <form> element, so that the values ​​entered 
  // by the user can be retrieved even outside of the standard submit event.
  const formRef = useRef<HTMLFormElement>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canRecoverProfile, setCanRecoverProfile] = useState(false);


  // Submit form handler: gets the data from the form and calls authService
  // to try and register a user and create their data in firestore.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username')).trim();
    const displayName = String(formData.get('displayName')).trim();
    const email = String(formData.get('email')).trim();
    const password = String(formData.get('password'));

    // Validate the username before creating an authentication account.
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setErrorMessage(
        'Username must contain 3–20 letters, numbers, or underscores.'
      );
      setIsSubmitting(false);
      return;
    }

    if (!displayName) {
      setErrorMessage('Please enter a display name.');
      setIsSubmitting(false);
      return;
    }

    try {
      const registrationData = {
        email: email,
        password: password,
        username: username,
        displayName: displayName,
      };

      // Hide authenticated navigation until both Auth and Firestore setup finish.
      // Auth can finish before the profile is actually created in firestore.
      authState.beginRegistration();
      // Wait for both account creation and Firestore profile creation to finish.
      await registerUserWithProfile(registrationData);
      // navigates to the home page
      setCanRecoverProfile(false);
      navigate('/home');

    } catch (error) {
      // Keep the original error available in the browser console for diagnosis.
      console.error('Account registration failed:', error);

      // Convert profile setup failures into the messages shown by the form.
      if (error instanceof RegistrationError && error.cleanupFailed) {
        setCanRecoverProfile(true);
        setErrorMessage(
          'Your account was created, but its profile could not be saved and the account could not be removed. Use the recovery action below to finish setting up this account.'
        );
      } else if (error instanceof RegistrationError) {
        const originalError = error.originalError;
        if (originalError instanceof Error && originalError.message === 'username-already-taken') {
          setErrorMessage('This username is already taken. Please choose another one. Your incomplete account was removed.');
        } else {
          setErrorMessage('The account was created, but profile setup failed. The incomplete account was removed; please try again.');
        }
      } else if (error instanceof Error && error.message === 'username-already-taken') {
        setErrorMessage(
          'This username is already taken. Please choose another one.'
        );
      } else if (error instanceof Error && 'code' in error) {
        const errorCode = error.code;

        if (errorCode === 'auth/email-already-in-use') {
          setErrorMessage('An account with this email already exists.');
        } else if (errorCode === 'auth/invalid-email') {
          setErrorMessage('Please enter a valid email address.');
        } else if (errorCode === 'auth/weak-password') {
          setErrorMessage(
            'Your password is too weak. Please choose a stronger password.'
          );
        } else if (errorCode === 'auth/operation-not-allowed') {
          setErrorMessage(
            'Email and password registration is not enabled.'
          );
        } else {
          setErrorMessage('Unable to create your account. Please try again.');
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
      authState.endRegistration();
      setIsSubmitting(false);
    }
  }


  // This function completes the profile configuration for a user whose Firebase Authentication
  // account has already been created, but whose profile has not been correctly saved to Firestore.
  async function handleProfileRecovery() {
    if (!canRecoverProfile || !formRef.current) {
      return;
    }

    // Read the editable username and display name again so recovery can correct a conflict.
    const formData = new FormData(formRef.current);
    const username = String(formData.get('username')).trim();
    const displayName = String(formData.get('displayName')).trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setErrorMessage('Username must contain 3–20 letters, numbers, or underscores.');
      return;
    }

    if (!displayName) {
      setErrorMessage('Please enter a display name.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    // calls the context function to set the registration as in progress
    authState.beginRegistration();

    try {
      await recoverRegistrationProfile({ username, displayName });
      setCanRecoverProfile(false);
      navigate('/home');
    } catch (error) {
      console.error('Registration profile recovery failed:', error);
      if (error instanceof Error && error.message === 'username-already-taken') {
        setErrorMessage('This username is no longer available. The account is still signed in; choose a different recovery plan before continuing.');
      } else {
        setErrorMessage('Profile recovery did not finish. Your account is still signed in; please retry this action.');
      }
    } finally {
      // calls the context to signal that the registration has ended
      authState.endRegistration();
      setIsSubmitting(false);
    }
  }


  // ========================
  // PAGE RENDERING AND FORM
  // ========================
  
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Join Pixeling!</h1>

        <p className="auth-description">
          Create an account and share your pixel art with the community.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} ref={formRef}>
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            placeholder="Choose a unique username"
            autoComplete="username"
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            title="Use 3–20 letters, numbers, or underscores."
            required
          />

          <label htmlFor="signup-display-name">Display name</label>
          <input
            id="signup-display-name"
            name="displayName"
            type="text"
            placeholder="Your public name"
            autoComplete="name"
            maxLength={50}
            required
          />

          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={6}
            required
          />

          {errorMessage && (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          {canRecoverProfile && (
            <button
              className="auth-submit"
              type="button"
              onClick={handleProfileRecovery}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Recovering profile...' : 'Complete profile setup'}
            </button>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? canRecoverProfile
                ? 'Recovering profile...'
                : 'Creating account...'
              : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

export default SigninPage;
