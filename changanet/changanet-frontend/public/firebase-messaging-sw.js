importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();