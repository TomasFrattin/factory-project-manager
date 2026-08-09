import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAAlQuFfxt9LUSfT1FASQtmsN1OV-HsS7U",
  authDomain: "factory-manager-79d25.firebaseapp.com",
  projectId: "factory-manager-79d25",
  storageBucket: "factory-manager-79d25.firebasestorage.app",
  messagingSenderId: "894547212789",
  appId: "1:894547212789:web:ffac13b4703e77c60d48bc"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Inicializamos y exportamos la base de datos Firestore
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});