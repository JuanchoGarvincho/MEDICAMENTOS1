import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD8L1EWxxLpsfIa7mNY7UAbgXu-aEpUFOo",
  authDomain: "medicamentos1-af4f7.firebaseapp.com",
  projectId: "medicamentos1-af4f7",
  storageBucket: "medicamentos1-af4f7.firebasestorage.app",
  messagingSenderId: "478921565495",
  appId: "1:478921565495:web:27db70634e599d22d326b2",
  measurementId: "G-59M38BXD9M"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { firebaseConfig, app, auth, db, googleProvider };
export default app;