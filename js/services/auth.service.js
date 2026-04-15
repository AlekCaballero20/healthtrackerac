import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { auth } from "./firebase.service.js";

// Correos autorizados para entrar a la app
// ⚠️ Cambia el segundo correo por el de Cata
const ALLOWED_EMAILS = [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com"
];

const provider = new GoogleAuthProvider();

/**
 * Verifica si un correo está dentro de la lista de permitidos.
 * @param {string} email
 * @returns {boolean}
 */
export function isAllowedEmail(email) {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Abre el popup de Google para iniciar sesión.
 * @returns {Promise<UserCredential>}
 */
export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

/**
 * Cierra la sesión del usuario actual.
 * @returns {Promise<void>}
 */
export async function signOutCurrentUser() {
  return signOut(auth);
}

/**
 * Observa cambios en el estado de autenticación.
 * Retorna la función unsubscribe para cancelar el listener.
 * @param {(user: User | null) => void} callback
 * @returns {() => void}
 */
export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
