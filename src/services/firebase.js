// src/services/firebase.js

// Using the global 'firebase' object from the compat scripts loaded in index.html

const firebaseConfig = {
    apiKey: "AIzaSyBxpVobPBzSJrswAMv-Xhwqwy1NabRJ8qQ",
    authDomain: "boond-efd01.firebaseapp.com",
    projectId: "boond-efd01",
    storageBucket: "boond-efd01.firebasestorage.app",
    messagingSenderId: "1088911916262",
    appId: "1:1088911916262:web:5bf1e063d5717968a2cf27"
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

console.log("Firebase initialized successfully");
