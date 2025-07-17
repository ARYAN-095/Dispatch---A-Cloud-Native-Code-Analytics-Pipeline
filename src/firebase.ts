// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
 import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBqVSPFY4p72D-059DTfY52yx1f4hdceG8",
  authDomain: "diapatch-e2c5b.firebaseapp.com",
  projectId: "diapatch-e2c5b",
  storageBucket: "diapatch-e2c5b.firebasestorage.app",
  messagingSenderId: "973875633413",
  appId: "1:973875633413:web:ab6392ccf98878edeaeb6c",
  measurementId: "G-S4K5G063GR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app)