/* ==========================================
   js/config.js
   ========================================== */

// Firebase SDK মডিউলগুলো CDN থেকে ইমপোর্ট করা হচ্ছে
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiZW_WtuMbNfh7KLYjv_aKeAbaL9FJ8-4",
  authDomain: "physflow-devs.firebaseapp.com",
  projectId: "physflow-devs",
  storageBucket: "physflow-devs.firebasestorage.app",
  messagingSenderId: "241187925332",
  appId: "1:241187925332:web:4e40aff9a3e62760406cc1",
  measurementId: "G-H9690N7R9G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export instances to use in other files
export const auth = getAuth(app);
export const db = getFirestore(app);


console.log("Firebase Configured Successfully!");
