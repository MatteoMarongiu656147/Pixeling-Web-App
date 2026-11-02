/**
 * Provides the Firebase authentication state to the application.
 * The default provider of this context is AuthProvider and it is used in router.tsx
 * 
 * the application can know the user's authentication status without having 
 * to retrieve it separately in each component. Avoids prop drilling.
 * 
 * The context provider listens to Firebase and updates the shared state; pages read that state.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

// This type represents the value of the context.
// contains information about the authentication (user, isLoggedIn etc)
type AuthContextValue = {
  user: User | null; // contains the firebase user or null
  isLoggedIn: boolean; 
  isLoading: boolean;
  isRegistrationInProgress: boolean; // determines if the registration flow is still ongoing
  beginRegistration: () => void; // signals the begin of the registration
  endRegistration: () => void; // signals the end of the registration
};

// CONTEXT CREATION
const AuthContext = createContext<AuthContextValue | null>(null);

// The props of the provider are React Nodes
type AuthProviderProps = {
  children: ReactNode;
};

// Provider
export function AuthProvider(props: AuthProviderProps) {

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistrationInProgress, setIsRegistrationInProgress] = useState(false);

  // executed only when the Provider component is mounted in the app
  useEffect(() => {
    // Keeps React synchronized with Firebase's authentication state by
    // calling the firebase function that listens to the authentication state.
    // The firebase's function returns a function that interrupts the listening.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    // cleanup: stops listening when the provider unmounts (executes the function in unsubscribe).
    return unsubscribe;
  }, []);


  // Value of the context
  const contextValue: AuthContextValue = {
    user: user,
    // Firebase may emit the new user before the registration profile is saved.
    // Keep the app's authenticated UI hidden until SigninPage completes the flow.
    isLoggedIn: user !== null && !isRegistrationInProgress,

    isLoading: isLoading,
    isRegistrationInProgress: isRegistrationInProgress,

    // These functions are called by the SigninPage to signal that the registration
    // is in progress. The registration will remain in progress until both Firebase auth
    // and firestore have finished creating the account and the profile (see SigninPage).
    beginRegistration: () => setIsRegistrationInProgress(true),
    endRegistration: () => setIsRegistrationInProgress(false),
  };


  // The provider distributes the value of contextValue.
  return (
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  );
}

// All the components will use "useAuth" instead of "useContext"
export function useAuth() {
  const contextValue = useContext(AuthContext);

  if (contextValue === null) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }

  return contextValue;
}
