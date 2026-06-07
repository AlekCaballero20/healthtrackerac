import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { APP_CONFIG, DEFAULT_PROFILES } from "./config.js";

export const isDemoMode = new URLSearchParams(window.location.search).has("demo");
const DEMO_KEY = "healthtrackerac-demo-data-v2";

let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;

if (!isDemoMode) {
  app = getApps().length ? getApp() : initializeApp(APP_CONFIG.firebase);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Sube un archivo y devuelve { name, url, path, size, type }.
// En modo demo guarda el archivo como data URL dentro del propio registro.
export async function uploadAttachment(file, folder = "attachments") {
  const base = { name: file.name, size: file.size, type: file.type };

  if (isDemoMode) {
    const url = await readFileAsDataURL(file);
    return { ...base, url, path: "" };
  }

  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { ...base, url, path };
}

export async function deleteAttachment(path) {
  if (isDemoMode || !path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch (error) {
    // Si ya no existe, no es un problema bloqueante.
    console.warn("No se pudo borrar el adjunto:", error?.message || error);
  }
}

const emptyData = () => Object.fromEntries(APP_CONFIG.collections.map((name) => [name, []]));

function demoSeed() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = offsetDate(-1);
  const nextWeek = offsetDate(7);
  const lastWeek = offsetDate(-7);

  return {
    ...emptyData(),
    profiles: [...DEFAULT_PROFILES],
    dailyLogs: [
      {
        id: "demo-log-1",
        profileId: "profile-alek",
        date: today,
        energy: 7,
        mood: "estable",
        sleepHours: 6.5,
        waterCups: 5,
        movementMinutes: 20,
        painLevel: 2,
        note: "Día relativamente estable. Café controlado, humanidad parcialmente soportable.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "demo-log-2",
        profileId: "profile-cata",
        date: yesterday,
        energy: 6,
        mood: "sensible",
        sleepHours: 7,
        waterCups: 6,
        movementMinutes: 30,
        painLevel: 3,
        note: "Buen descanso, algo de tensión en hombros.",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString()
      }
    ],
    symptoms: [
      {
        id: "demo-sym-1",
        profileId: "profile-cata",
        name: "Tensión en hombros",
        bodyPart: "Hombros",
        intensity: 5,
        duration: "2 días",
        frequency: "Intermitente",
        startDate: lastWeek,
        triggers: "Estrés y computador",
        trend: "mejorando",
        notes: "Hacer pausas y estiramientos suaves.",
        status: "en observación",
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        updatedAt: new Date(Date.now() - 604800000).toISOString()
      }
    ],
    appointments: [
      {
        id: "demo-apt-1",
        profileId: "profile-alek",
        specialty: "Medicina general",
        doctor: "",
        date: nextWeek,
        time: "10:30",
        location: "Por definir",
        reason: "Chequeo general",
        status: "agendada",
        result: "",
        nextSteps: "",
        notes: "Llevar preguntas anotadas.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    checkups: [
      {
        id: "demo-chk-1",
        profileId: "profile-cata",
        name: "Odontología",
        frequencyMonths: 6,
        lastDoneDate: offsetDate(-190),
        idealNextDate: offsetDate(-10),
        status: "atrasado",
        priority: "media",
        observations: "Agendar limpieza.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    treatments: [],
    notes: [
      {
        id: "demo-note-1",
        profileId: "profile-alek",
        title: "Patrón posible",
        category: "Observación",
        content: "Cuando baja el sueño, sube el antojo de café y baja la energía al día siguiente. Qué descubrimiento, el cuerpo funciona.",
        date: today,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    bodyStatusEntries: []
  };
}

function getDemoData() {
  const stored = localStorage.getItem(DEMO_KEY);
  if (!stored) {
    const seeded = demoSeed();
    localStorage.setItem(DEMO_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return { ...emptyData(), ...JSON.parse(stored) };
  } catch {
    const seeded = demoSeed();
    localStorage.setItem(DEMO_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveDemoData(data) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isAllowedEmail(email) {
  if (isDemoMode) return true;
  return APP_CONFIG.allowedEmails.includes(String(email || "").toLowerCase().trim());
}

export function observeSession(callback) {
  if (isDemoMode) {
    queueMicrotask(() => callback({
      uid: "demo-user",
      email: "demo@healthtrackerac.local",
      displayName: "Modo demo"
    }));
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  if (isDemoMode) return null;
  return signInWithPopup(auth, googleProvider);
}

export async function logoutCurrentUser() {
  if (isDemoMode) return null;
  return signOut(auth);
}

async function ensureDefaultProfiles() {
  const snapshot = await getDocs(collection(db, "profiles"));
  if (!snapshot.empty) return;

  await Promise.all(
    DEFAULT_PROFILES.map((profile) => setDoc(doc(db, "profiles", profile.id), profile))
  );
}

async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function loadAllData() {
  if (isDemoMode) return getDemoData();

  await ensureDefaultProfiles();
  const results = await Promise.all(APP_CONFIG.collections.map(readCollection));
  return Object.fromEntries(APP_CONFIG.collections.map((name, index) => [name, results[index]]));
}

export async function createRecord(collectionName, record) {
  if (!record?.id) throw new Error("El registro necesita un ID.");

  if (isDemoMode) {
    const data = getDemoData();
    const collectionData = Array.isArray(data[collectionName]) ? data[collectionName] : [];
    data[collectionName] = [record, ...collectionData.filter((item) => item.id !== record.id)];
    saveDemoData(data);
    return record;
  }

  await setDoc(doc(db, collectionName, record.id), record);
  return record;
}

export async function updateRecord(collectionName, id, patch) {
  if (!id) throw new Error("Falta el ID para actualizar.");
  const update = { ...patch, updatedAt: new Date().toISOString() };

  if (isDemoMode) {
    const data = getDemoData();
    data[collectionName] = (data[collectionName] || []).map((item) =>
      item.id === id ? { ...item, ...update } : item
    );
    saveDemoData(data);
    return;
  }

  await updateDoc(doc(db, collectionName, id), update);
}

export async function removeRecord(collectionName, id) {
  if (!id) throw new Error("Falta el ID para eliminar.");

  if (isDemoMode) {
    const data = getDemoData();
    data[collectionName] = (data[collectionName] || []).filter((item) => item.id !== id);
    saveDemoData(data);
    return;
  }

  await deleteDoc(doc(db, collectionName, id));
}

export async function importRecords(data) {
  const normalized = { ...emptyData(), ...data };

  if (isDemoMode) {
    const current = getDemoData();
    APP_CONFIG.collections.forEach((collectionName) => {
      const incoming = normalized[collectionName] || [];
      const currentItems = current[collectionName] || [];
      const byId = new Map(currentItems.map((item) => [item.id, item]));
      incoming.forEach((item) => byId.set(item.id, item));
      current[collectionName] = [...byId.values()];
    });
    saveDemoData(current);
    return;
  }

  const writes = [];
  APP_CONFIG.collections.forEach((collectionName) => {
    (normalized[collectionName] || []).forEach((item) => {
      if (item?.id) writes.push(setDoc(doc(db, collectionName, item.id), item));
    });
  });
  await Promise.all(writes);
}
