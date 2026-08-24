export const APP_CONFIG = Object.freeze({
  appName: "Health Tracker AC",
  version: "2.0.0-glowup",
  allowedEmails: [
    "alekcaballeromusic@gmail.com",
    "catalina.medina.leal@gmail.com"
  ],
  firebase: {
    apiKey: "AIzaSyBGkKvRjbYN69uucxt2mQcw3QQfB6p5Gug",
    authDomain: "health-tracker-ac.firebaseapp.com",
    projectId: "health-tracker-ac",
    storageBucket: "health-tracker-ac.firebasestorage.app",
    messagingSenderId: "815515224336",
    appId: "1:815515224336:web:dab37607be99fa4bebfd95"
  },
  collections: [
    "profiles",
    "dailyLogs",
    "bodyStatusEntries",
    "symptoms",
    "appointments",
    "checkups",
    "treatments",
    "notes",
    "vitals",
    "weights"
  ]
});

export const DEFAULT_PROFILES = Object.freeze([
  {
    id: "profile-alek",
    name: "Alek",
    shortGoal: "Seguimiento general de salud, síntomas y controles médicos"
  },
  {
    id: "profile-cata",
    name: "Cata",
    shortGoal: "Seguimiento integral de bienestar y autocuidado"
  }
]);

// Mapa del cuerpo: secciones y sus zonas.
// IMPORTANTE: los nombres de las zonas son exactamente los mismos que ya se
// venían guardando, para que los registros anteriores sigan encajando.
export const BODY_MAP = Object.freeze([
  { id: "cabeza", label: "Cabeza y cuello", zones: ["Cabeza", "Ojos", "Oídos", "Nariz y garganta", "Dientes / boca", "Cuello"] },
  { id: "pecho", label: "Pecho y respiración", zones: ["Pecho", "Respiración", "Corazón"] },
  { id: "abdomen", label: "Abdomen y digestión", zones: ["Abdomen / estómago", "Digestión"] },
  { id: "espalda", label: "Espalda", zones: ["Espalda", "Zona lumbar"] },
  { id: "brazos", label: "Brazos y manos", zones: ["Hombros", "Brazos / manos"] },
  { id: "piernas", label: "Piernas y pies", zones: ["Piernas / rodillas", "Pies"] },
  { id: "piel", label: "Piel", zones: ["Piel"] },
  { id: "general", label: "Bienestar general", zones: ["Sueño", "Energía", "Estado emocional"] }
]);

// Lista plana de zonas: se deriva del mapa, así nunca se desincronizan.
export const BODY_PARTS = Object.freeze(BODY_MAP.flatMap((section) => section.zones));

const SECTION_BY_ZONE = Object.freeze(
  Object.fromEntries(BODY_MAP.flatMap((section) => section.zones.map((zone) => [zone, section.id])))
);

export function sectionIdForZone(zone) {
  return SECTION_BY_ZONE[zone] || null;
}

export function sectionById(id) {
  return BODY_MAP.find((section) => section.id === id) || null;
}

// Rangos de presión arterial (referencia informativa, no un diagnóstico).
// Se evalúan en orden y gana el primero que cumple: los valores altos mandan,
// así una sistólica alta no queda oculta por una diastólica baja.
export const BP_LEVELS = Object.freeze([
  { id: "muy-alta", label: "Muy alta", tone: "danger", test: (s, d) => s >= 180 || d >= 120 },
  { id: "alta-2", label: "Alta (grado 2)", tone: "danger", test: (s, d) => s >= 140 || d >= 90 },
  { id: "alta-1", label: "Alta (grado 1)", tone: "warning", test: (s, d) => s >= 130 || d >= 80 },
  { id: "baja", label: "Baja", tone: "warning", test: (s, d) => s < 90 || d < 60 },
  { id: "elevada", label: "Elevada", tone: "warning", test: (s) => s >= 120 },
  { id: "normal", label: "Normal", tone: "success", test: () => true }
]);

export const STATUS_OPTIONS = Object.freeze([
  "Bien",
  "Molestia leve",
  "Molestia moderada",
  "Dolor",
  "Tensión",
  "Sensibilidad",
  "En observación",
  "Fatiga",
  "Ansiedad",
  "Tranquilo"
]);

export const FREQUENCY_OPTIONS = Object.freeze([
  "Constante",
  "Diaria",
  "Intermitente",
  "Semanal",
  "Ocasional",
  "Solo bajo estrés",
  "Solo en la noche",
  "Solo al despertar"
]);

export const SPECIALTIES = Object.freeze([
  "Medicina general",
  "Odontología",
  "Oftalmología",
  "Dermatología",
  "Psicología / salud mental",
  "Otorrino",
  "Fisioterapia",
  "Cardiología",
  "Nutrición",
  "Laboratorio",
  "Otra"
]);

export const CHECKUP_TYPES = Object.freeze([
  "Odontología",
  "Medicina general",
  "Exámenes de sangre",
  "Visión",
  "Salud mental",
  "Dermatología",
  "Chequeo general",
  "Vacunación",
  "Otra"
]);
