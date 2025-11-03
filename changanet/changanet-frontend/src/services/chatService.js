import { ref, push, onValue, off, set, update, remove } from "firebase/database";
import { getDatabase } from "firebase/database";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA93wqcIxGpPCfyUBMq4ZwBxJRDfkKGXfQ",
  authDomain: "changanet-notifications.firebaseapp.com",
  projectId: "changanet-notifications",
  storageBucket: "changanet-notifications.appspot.com",
  messagingSenderId: "926478045621",
  appId: "1:926478045621:web:6704a255057b65a6e549fc"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Enviar mensaje
export const sendMessage = async (chatId, message) => {
  try {
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, {
      ...message,
      timestamp: Date.now()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Escuchar mensajes en tiempo real
export const listenToMessages = (chatId, callback) => {
  const messagesRef = ref(database, `chats/${chatId}/messages`);
  onValue(messagesRef, (snapshot) => {
    const messages = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    callback(messages);
  });
  return () => off(messagesRef);
};

// Crear nuevo chat
export const createChat = async (chatData) => {
  try {
    const chatsRef = ref(database, 'chats');
    const newChatRef = push(chatsRef);
    await set(newChatRef, {
      ...chatData,
      createdAt: Date.now()
    });
    return { success: true, chatId: newChatRef.key };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Actualizar estado del chat
export const updateChatStatus = async (chatId, status) => {
  try {
    const chatRef = ref(database, `chats/${chatId}`);
    await update(chatRef, { status, lastUpdated: Date.now() });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Eliminar chat
export const deleteChat = async (chatId) => {
  try {
    const chatRef = ref(database, `chats/${chatId}`);
    await remove(chatRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Obtener chats de un usuario
export const getUserChats = (userId, callback) => {
  const userChatsRef = ref(database, `userChats/${userId}`);
  onValue(userChatsRef, (snapshot) => {
    const chats = [];
    snapshot.forEach((childSnapshot) => {
      chats.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    callback(chats);
  });
  return () => off(userChatsRef);
};