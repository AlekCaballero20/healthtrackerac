import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase.service.js";

// Nombres exactos de las colecciones en Firestore
const COLLECTION_NAMES = [
  "profiles",
  "bodyStatusEntries",
  "symptoms",
  "appointments",
  "checkups",
  "treatments",
  "notes"
];

// Perfiles por defecto que se crean si Firestore está vacío
const DEFAULT_PROFILES = [
  {
    id: "profile-alek",
    name: "Alek",
    shortGoal: "Seguimiento general de salud"
  },
  {
    id: "profile-cata",
    name: "Cata",
    shortGoal: "Seguimiento general de salud"
  }
];

/**
 * Lee todos los documentos de una colección y retorna un array.
 * @param {string} name
 * @returns {Promise<Object[]>}
 */
async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((d) => ({ ...d.data() }));
}

/**
 * Si no existen perfiles en Firestore, crea los perfiles por defecto.
 * Esto solo ocurre una vez en la primera carga.
 */
async function ensureDefaultProfiles() {
  const snapshot = await getDocs(collection(db, "profiles"));
  if (!snapshot.empty) return;

  await Promise.all(
    DEFAULT_PROFILES.map((profile) =>
      setDoc(doc(db, "profiles", profile.id), profile)
    )
  );
}

/**
 * Carga todos los datos de la app desde Firestore en paralelo.
 * Si es la primera vez, inicializa los perfiles de Alek y Cata.
 * @returns {Promise<Object>}
 */
export async function loadAppData() {
  await ensureDefaultProfiles();

  const results = await Promise.all(COLLECTION_NAMES.map(readCollection));

  return Object.fromEntries(
    COLLECTION_NAMES.map((name, i) => [name, results[i]])
  );
}

/**
 * Crea un documento en Firestore usando el id del record como document ID.
 * @param {string} collectionName
 * @param {Object} record - Debe tener un campo `id`
 * @returns {Promise<Object>}
 */
export async function createRecord(collectionName, record) {
  const ref = doc(db, collectionName, record.id);
  await setDoc(ref, record);
  return record;
}

/**
 * Actualiza campos específicos de un documento existente.
 * @param {string} collectionName
 * @param {string} id
 * @param {Object} patch
 * @returns {Promise<void>}
 */
export async function updateRecord(collectionName, id, patch) {
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, patch);
}

/**
 * Elimina un documento de Firestore.
 * @param {string} collectionName
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteRecord(collectionName, id) {
  const ref = doc(db, collectionName, id);
  await deleteDoc(ref);
}
