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
    "notes"
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

export const BODY_PARTS = Object.freeze([
  "Cabeza",
  "Ojos",
  "Oídos",
  "Nariz y garganta",
  "Dientes / boca",
  "Cuello",
  "Hombros",
  "Brazos / manos",
  "Pecho",
  "Respiración",
  "Corazón",
  "Espalda",
  "Abdomen / estómago",
  "Digestión",
  "Zona lumbar",
  "Piel",
  "Piernas / rodillas",
  "Pies",
  "Sueño",
  "Energía",
  "Estado emocional"
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
