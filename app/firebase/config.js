import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBnR5DR411Hd3aUdEonMpsMB1ptDryfMQA",
  authDomain: "dil-e-azaan.firebaseapp.com",
  projectId: "dil-e-azaan",
  storageBucket: "dil-e-azaan.appspot.com",
  messagingSenderId: "262574826441",
  appId: "1:262574826441:web:51cc7c959dcf760e4e7e18",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);