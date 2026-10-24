// Single Firebase setup shared by every page. Change the SDK version here only.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
export * from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
export * from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// These keys are public by design. Protect them with HTTP-referrer restrictions in Google Cloud Console.
export const firebaseConfig = {
  apiKey: "AIzaSyAIQVEXNrIu3ZhhQ0qJKMZpOSKZ2EPD25E",
  authDomain: "pixelroot-9da60.firebaseapp.com",
  projectId: "pixelroot-9da60",
  storageBucket: "pixelroot-9da60.firebasestorage.app",
  messagingSenderId: "320500176338",
  appId: "1:320500176338:web:033d785c5f716779eb240b",
  measurementId: "G-WBE5F8ZKSF"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
