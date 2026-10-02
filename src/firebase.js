// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCSPSJyRKHS3T-Yd4H_rJD-4K9dQ4PUG6c",
  authDomain: "vikings-soccer.firebaseapp.com",
  projectId: "vikings-soccer",
  storageBucket: "vikings-soccer.firebasestorage.app",
  messagingSenderId: "809549830059",
  appId: "1:809549830059:web:604fe246d064afdf2464ee"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);