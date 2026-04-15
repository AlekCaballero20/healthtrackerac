import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Configuración oficial de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBGkKvRjbYN69uucxt2mQcw3QQfB6p5Gug",
  authDomain: "health-tracker-ac.firebaseapp.com",
  projectId: "health-tracker-ac",
  storageBucket: "health-tracker-ac.firebasestorage.app",
  messagingSenderId: "815515224336",
  appId: "1:815515224336:web:dab37607be99fa4bebfd95"
};

// Evita reinicializar Firebase si este archivo se importa más de una vez
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Servicios principales
const auth = getAuth(app);
const db = getFirestore(app);

// Proveedor de Google, por si vas a usar login con Google
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// Exports
export { app, auth, db, googleProvider };
export default app;