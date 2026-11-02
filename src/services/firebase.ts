
/**
 * Initializes Firebase services used throughout Pixeling.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import firebaseConfig from './firebaseConfig';

// Initialize Firebase.
const firebaseApp = initializeApp(firebaseConfig);

// Firebase Authentication.
export const auth = getAuth(firebaseApp);

// Firestore
export const db = getFirestore(firebaseApp);

export default firebaseApp;
