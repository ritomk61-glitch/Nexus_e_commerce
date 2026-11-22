import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./config.js";

/**
 * Format Firebase Auth errors into user-friendly messages.
 */
export function formatAuthError(error) {
  if (!error) return "An unknown error occurred.";
  const code = error.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/too-many-requests":
      return "Too many unsuccessful attempts. Please wait a few moments and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before finishing.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups for Google sign-in.";
    case "auth/network-request-failed":
      return "Network connection error. Please check your internet connection.";
    default:
      return error.message || "Authentication failed. Please try again.";
  }
}

/**
 * Ensures a user profile document exists in Firestore under users/{uid}.
 * Does not overwrite existing roles or address books.
 */
export async function syncUserProfile(firebaseUser, additionalData = {}) {
  if (!firebaseUser) return null;
  const userRef = doc(db, "users", firebaseUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const newProfile = {
        uid: firebaseUser.uid,
        fullName:
          additionalData.fullName ||
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          "NEXUS Engineer",
        email: firebaseUser.email || "",
        phone: additionalData.phone || firebaseUser.phoneNumber || "",
        photoURL: firebaseUser.photoURL || "",
        role: "user", // strictly defaults to 'user' on creation
        addresses: additionalData.addresses || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    } else {
      const existing = snap.data();
      // Optional touch of updatedAt
      await updateDoc(userRef, { updatedAt: serverTimestamp() }).catch(() => {});
      return existing;
    }
  } catch (err) {
    console.error("Error syncing user profile:", err);
    // Return fallback profile if Firestore is unavailable
    return {
      uid: firebaseUser.uid,
      fullName:
        additionalData.fullName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split("@")[0] ||
        "NEXUS Engineer",
      email: firebaseUser.email,
      phone: additionalData.phone || "",
      photoURL: firebaseUser.photoURL || "",
      role: "user",
      addresses: [],
    };
  }
}

/**
 * Register a new user with Email and Password
 */
export async function registerWithEmail({ name, email, password }) {
  if (!name || name.trim().length < 2) {
    throw new Error("Please enter your full name.");
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name) {
    await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
  }
  const profile = await syncUserProfile(cred.user, { fullName: name.trim() });
  const token = await cred.user.getIdToken();

  // Send Firebase email verification link
  try {
    await sendEmailVerification(cred.user);
    console.log("[Auth] Verification email sent to", cred.user.email);
  } catch (verifyErr) {
    console.warn("[Auth] Could not send verification email:", verifyErr.message);
  }

  return {
    user: {
      ...profile,
      name: profile?.fullName || name.trim(),
      email: cred.user.email,
      uid: cred.user.uid,
      emailVerified: cred.user.emailVerified,
    },
    token,
    verificationEmailSent: true,
  };
}

/**
 * Sign in existing user with Email and Password
 */
export async function loginWithEmail({ email, password }) {
  if (!email || !password) {
    throw new Error("Please enter both email and password.");
  }
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await syncUserProfile(cred.user);
  const token = await cred.user.getIdToken();
  return {
    user: {
      ...profile,
      name: profile?.fullName || cred.user.displayName || cred.user.email?.split("@")[0],
      email: cred.user.email,
      uid: cred.user.uid,
      emailVerified: cred.user.emailVerified,
    },
    token,
  };
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const profile = await syncUserProfile(cred.user, {
    fullName: cred.user.displayName,
  });
  const token = await cred.user.getIdToken();
  return {
    user: {
      ...profile,
      name: profile?.fullName || cred.user.displayName || cred.user.email?.split("@")[0],
      email: cred.user.email,
      uid: cred.user.uid,
      emailVerified: cred.user.emailVerified,
    },
    token,
  };
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email) {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error("Please provide a valid registered email address.");
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Resend email verification to currently signed-in user
 */
export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error("No user signed in.");
  if (auth.currentUser.emailVerified) throw new Error("Email is already verified.");
  await sendEmailVerification(auth.currentUser);
}

/**
 * Sign out current user
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Get current Firebase Auth ID Token for API authorization
 */
export async function getAuthToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

/**
 * Subscribe to Firebase Auth state changes
 */
export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);
        const profile = snap.exists() ? snap.data() : await syncUserProfile(firebaseUser);
        const token = await firebaseUser.getIdToken();
        callback({
          ...profile,
          name: profile?.fullName || firebaseUser.displayName || firebaseUser.email?.split("@")[0],
          email: firebaseUser.email,
          uid: firebaseUser.uid,
          emailVerified: firebaseUser.emailVerified,
          token,
        });
      } catch (err) {
        console.error("Error fetching user profile on auth change:", err);
        callback({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0],
          email: firebaseUser.email,
          role: "user",
          addresses: [],
        });
      }
    } else {
      callback(null);
    }
  });
}
