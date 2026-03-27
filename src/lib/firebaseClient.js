import { initializeApp } from "firebase/app";
import { getMessaging, onMessage as firebaseOnMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDYUTD9r-797Dusa31767bbAywhqdocRJY",
  authDomain: "it-helpdesk-4aa0f.firebaseapp.com",
  projectId: "it-helpdesk-4aa0f",
  storageBucket: "it-helpdesk-4aa0f.firebasestorage.app",
  messagingSenderId: "91772122610",
  appId: "1:91772122610:web:d7bccc499aa404b1c1a76b",
  measurementId: "G-RM2W6M7LPT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
export const VAPID_KEY = "BPi9AeahyK4TJjFbYgjZSSEA9WDa2EqwwluHaDBuVaU4uPVmY6BsQ2JZwdm5RSo7yiLfT7tE13sMHQk8jRKP6FU";

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (messaging) {
      firebaseOnMessage(messaging, (payload) => {
        resolve(payload);
      });
    }
  });

export default app;
