import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle as firebaseLoginWithGoogle,
  sendPasswordReset,
  logoutUser,
  getAuthToken,
  subscribeToAuth,
  formatAuthError,
} from "@/firebase/auth.js";

/**
 * Register a new user with Firebase Authentication and initialize Firestore profile
 */
export async function register({ name, email, password }) {
  try {
    return await registerWithEmail({ name, email, password });
  } catch (err) {
    throw new Error(formatAuthError(err));
  }
}

/**
 * Log in an existing user with Firebase Authentication
 */
export async function login({ email, password }) {
  try {
    return await loginWithEmail({ email, password });
  } catch (err) {
    throw new Error(formatAuthError(err));
  }
}

/**
 * Log in with Google
 */
export async function loginWithGoogle() {
  try {
    return await firebaseLoginWithGoogle();
  } catch (err) {
    throw new Error(formatAuthError(err));
  }
}

/**
 * Send password reset email
 */
export async function forgotPassword(email) {
  try {
    return await sendPasswordReset(email);
  } catch (err) {
    throw new Error(formatAuthError(err));
  }
}

/**
 * Log out
 */
export async function logout() {
  return logoutUser();
}

/**
 * Get active ID token for API authorization
 */
export async function getToken() {
  return getAuthToken();
}

/**
 * Subscribe to authentication state updates
 */
export function onAuthState(callback) {
  return subscribeToAuth(callback);
}
