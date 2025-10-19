// Importar las funciones necesarias de los SDKs de Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";

// Configuración de Firebase para Changánet
const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios de Firebase
export const auth = getAuth(app);
export const storage = getStorage(app);
export const database = getDatabase(app);
export const messaging = getMessaging(app);
export const analytics = getAnalytics(app);

// Exportar la app por si es necesaria
export default app;