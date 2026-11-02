
/**
 * Displays the login form for existing users.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SubmitEvent } from 'react';
import '../app/App.css';
import { logInUser } from '../services/authService';

function LoginPage() {

  // needed for trying to navigate to /home when a login occurs
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // This handleSubmit function is executed by the login form on submit.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {

    event.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);

    // automatically gets all the data written by the user in a form
    const formData = new FormData(event.currentTarget);

    // gets the data from FormData
    const email = String(formData.get('email')).trim();
    const password = String(formData.get('password'));

    try {
      // Signs in the user with Firebase Authentication, calling the authService
      // (authService calls firebase).
      await logInUser(email, password);
      // navigates to the home page after the login.
      navigate('/home');
    } catch (error) {
      // Shows a friendly message when login fails.
      // Keep the Firebase error available in the browser console for diagnosis.
      console.error('Firebase login failed:', error);
      if (error instanceof Error && 'code' in error) {
        const errorCode = error.code;
        // displays the error that occurred with the failed login.
        if (errorCode === 'auth/invalid-credential') {
          setErrorMessage('Incorrect email or password.');
        } else if (errorCode === 'auth/invalid-email') {
          setErrorMessage('Please enter a valid email address.');
        } else if (errorCode === 'auth/too-many-requests') {
          setErrorMessage('Too many attempts. Please try again later.');
        } else {
          setErrorMessage('Unable to log in. Please try again.');
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Welcome back!</h1>
        <p className="auth-description">
          Log in to continue exploring pixel art.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {errorMessage && (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/signin">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
