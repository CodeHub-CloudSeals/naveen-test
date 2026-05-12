import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBPZ--b49jYqyn0PdP606x64OsBNDe1t24",
  authDomain: "complisight-uat.firebaseapp.com",
  projectId: "complisight-uat",
  storageBucket: "complisight-uat.firebasestorage.app",
  messagingSenderId: "460918627115",
  appId: "1:460918627115:android:20670728b8e4bf9b5f436e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
