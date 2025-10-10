'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, displayName?: string): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(userCredential => {
      if (userCredential.user && displayName) {
        // We can chain the profile update, but we don't block on it.
        updateProfile(userCredential.user, { displayName });
      }
    })
    .catch(error => {
      // Non-blocking, but you might want to log this or handle it globally.
      console.error("Sign-up failed (non-blocking):", error);
    });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password)
    .catch(error => {
      // Non-blocking, but you might want to log this or handle it globally.
      console.error("Sign-in failed (non-blocking):", error);
    });
}
