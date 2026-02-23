import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCc5bB8cn23SX5gNdeWbqZbnils4HzShZw",
  authDomain: "sistema-rubricas.firebaseapp.com",
  projectId: "sistema-rubricas",
  storageBucket: "sistema-rubricas.firebasestorage.app",
  messagingSenderId: "841899532564",
  appId: "1:841899532564:web:09964357c8c5bdca76a201",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
