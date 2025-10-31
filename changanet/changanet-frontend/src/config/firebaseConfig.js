// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";

// Tu configuración de Firebase (NO MODIFICAR)
const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.firebasestorage.app",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

// 🚀 Inicializar Firebase (una sola vez)
const app = initializeApp(firebaseConfig);

// ✅ Exportar servicios con la app correctamente pasada
export const auth = getAuth(app); // ← ¡ESTO ES CLAVE!
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// 📲 Función para solicitar token FCM
export const requestFCMToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // 🔐 VAPID KEY real (desde Firebase Console > Cloud Messaging)
      const vapidKey = "BBcq0rChqpfQkexHGzbzAcPNyEcXQ6pHimpgltESqpSgmMmiQEPK2yfv87taE80q794Q_wtvRc8Zlnal75mqpoo";
      const fcmToken = await getToken(messaging, { vapidKey });
      console.log("✅ FCM Token:", fcmToken);
      return fcmToken;
    } else {
      console.warn("⚠️ Permiso de notificaciones denegado");
      return null;
    }
  } catch (error) {
    console.error("❌ Error al obtener FCM token:", error);
    return null;
  }
};

// Función para escuchar mensajes en foreground
import { onMessage } from "firebase/messaging";

export const onForegroundMessage = () => {
  if (!messaging) {
    console.warn('Firebase Messaging no disponible para escuchar mensajes en foreground');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('📬 Mensaje recibido en foreground:', payload);
    // Mostrar notificación en la UI
    const { title, body } = payload.notification;
    new Notification(title, { body });
  });
};

// Función de diagnóstico para verificar configuración
export const diagnoseFirebaseConfig = () => {
  console.log('🔍 Diagnóstico de Firebase:');
  console.log('- App inicializada:', !!app);
  console.log('- Auth disponible:', !!auth);
  console.log('- Google Provider configurado:', !!googleProvider);
  console.log('- Messaging disponible:', !!messaging);
  console.log('- VAPID Key configurada:', true);

  return {
    appInitialized: !!app,
    authAvailable: !!auth,
    googleProviderConfigured: !!googleProvider,
    messagingAvailable: !!messaging,
    vapidKeyConfigured: true
  };
};