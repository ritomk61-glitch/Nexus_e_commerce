import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBToOOnnUOop8n6spJMxMZLuw0gbyNbRko",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nexus-1607a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nexus-1607a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nexus-1607a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "556955800579",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:556955800579:web:9f6dd12ce55411d6e46a36",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-5VNM91XWR2",
};

// Avoid multiple initializations
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Lazy-load analytics only on client-side when supported
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // Analytics not supported in this environment (e.g. cookies blocked)
    });
}
