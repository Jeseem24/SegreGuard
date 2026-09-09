import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyChuvLH_rSc4mIEkgPllpS4C3Dhn5CLstc",
  authDomain: "segreguard-ab8e0.firebaseapp.com",
  projectId: "segreguard-ab8e0",
  storageBucket: "segreguard-ab8e0.firebasestorage.app",
  messagingSenderId: "290264446512",
  appId: "1:290264446512:web:c16156c80990b69a6f9ff5",
  measurementId: "G-VXZ93DSBJV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
export default app;
