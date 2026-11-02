/**
 * Provides Firebase Authentication actions for the Pixeling application.
 */

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';

import { auth } from './firebase';
import { createUserProfile } from './userProfileService';

// Data needed for registration
export type RegisterUserData = {
  email: string;
  password: string;
  username: string;
  displayName: string;
};

export type RegistrationProfileData = Pick<
  RegisterUserData,
  'username' | 'displayName'
>;


// Error class
export class RegistrationError extends Error {
  readonly cleanupFailed: boolean;
  readonly originalError: unknown;

  constructor(
    message: string,
    cleanupFailed: boolean,
    originalError: unknown
  ) {
    super(message);
    this.name = 'RegistrationError';
    this.cleanupFailed = cleanupFailed;
    this.originalError = originalError;
  }
}


// -------------------------------------------------------------------------------

// Creates the Firebase account and waits until its Firestore profile is saved.
export async function registerUserWithProfile(registrationData: RegisterUserData): Promise<UserCredential> {

  let createdUser: UserCredential['user'] | null = null;

  try {
    // calls the firebase function to create a new user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      registrationData.email,
      registrationData.password
    );

    createdUser = userCredential.user;

    // Save the public displayname in firebase authentication, before creating the profile document.
    await updateProfile(createdUser, {
      displayName: registrationData.displayName,
    });

    // userProfileService's function: creates a user's profile in firestore
    await createUserProfile({
      uid: createdUser.uid,
      username: registrationData.username,
      displayName: registrationData.displayName,
    });

    return userCredential;

  } catch (error) {
    // Account creation and Firestore profile creation are separate operations.
    // If profile setup fails, try to remove the new account once; do not hide
    // whether that compensation also failed.
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch (cleanupError) {
        console.error('Failed to clean up the new account:', cleanupError);
        throw new RegistrationError(
          'registration-cleanup-failed',
          true,
          error
        );
      }

      throw new RegistrationError(
        'registration-profile-setup-failed',
        false,
        error
      );
    }

    throw error;
  }
}


// ----------------------------------------------------------------------------------------------

// recover an incomplete registration, in cases where the Firebase Authentication account already exists but the 
// profile creation process did not complete successfully.
export async function recoverRegistrationProfile(registrationData: RegistrationProfileData): Promise<void> {

  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('not-authenticated');
  }

  await updateProfile(currentUser, {
    displayName: registrationData.displayName,
  });

  await createUserProfile({
    uid: currentUser.uid,
    username: registrationData.username,
    displayName: registrationData.displayName,
  });
}


// ------------------------------------------------------------------------------------

// Signs in an existing user with email and password.
export function logInUser(email: string,  password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

// -------------------------------------------------------------------------------------

// Updates the display name stored on the currently authenticated Firebase user.
export async function updateCurrentUserDisplayName(displayName: string): Promise<void> {
  
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('not-authenticated');
  }

  await updateProfile(currentUser, {
    displayName: displayName,
  });
}

// -------------------------------------------------------------------------------------

// Signs out the currently authenticated user.
export function logOutUser() {
  return signOut(auth);
}
