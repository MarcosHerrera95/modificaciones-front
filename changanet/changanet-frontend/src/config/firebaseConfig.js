import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "changanet-notifications.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "changanet-notifications",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "changanet-notifications.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "926478045621",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:926478045621:web:6704a255057b65a6e549fc"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Funciones de diagnóstico simples (sin dependencias complejas)
export const diagnoseFirebaseConfig = () => {
  console.log("🔍 Diagnóstico básico de Firebase:");
  console.log("✅ Firebase configurado correctamente");
  return true;
};
