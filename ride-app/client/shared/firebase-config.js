// Lifeline - Firebase Configuration
/*
  INSTRUCTIONS:
  1. Go to: https://console.firebase.google.com
  2. Click the gear icon ⚙️ next to "Project Overview"
  3. Click "Project settings"
  4. Scroll down to "Your apps" section
  5. Find "SDK setup and configuration"
  6. Copy the values and replace the placeholders below
  
  IMPORTANT: Replace ALL "YOUR_..." values with your actual Firebase credentials!
*/

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyAXYv6SnTRcmJaV-z89UeeXg4fjzp_t1_E",
  authDomain: "lifeline-app-8f61e.firebaseapp.com",
  projectId: "lifeline-app-8f61e",
  storageBucket: "lifeline-app-8f61e.firebasestorage.app",
  messagingSenderId: "317065688818",
  appId: "1:317065688818:web:a53007f45246f7ec91c26b",
  measurementId: "G-NXMHEXNND6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth and provider for use in other files
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// For Agent - this is configured and ready to use
console.log('Firebase initialized successfully');