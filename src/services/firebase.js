// src/services/firebase.js

// Using the global 'firebase' object from the compat scripts loaded in index.html

const firebaseConfig = {
    apiKey: "AIzaSyBxHyi8WgV0RG9dMuqk0f31Qlgw0h9j1ak",
    authDomain: "boond-social.firebaseapp.com",
    projectId: "boond-social",
    storageBucket: "boond-social.firebasestorage.app",
    messagingSenderId: "969550234999",
    appId: "1:969550234999:web:14453f6d92d480dccc0d72"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export auth and db for use in other components
// In this non-module environment, we assign them to window or a global object
window.auth = firebase.auth();
window.db = firebase.firestore();
window.googleProvider = new firebase.auth.GoogleAuthProvider();
window.storage = firebase.storage();

console.log("Firebase initialized successfully");
