// Estado global de la app y helpers que dependen de ese estado.

import { APP_CONFIG } from "./config.js";

export const state = {
  user: null,
  authReady: false,
  allowed: false,
  loading: true,
  error: null,
  activeView: "dashboard",
  selectedProfileId: "all",
  activeRecordType: "daily",
  editingId: null,        // id del registro en edición (null = creando)
  editingCollection: null,
  timelineSearch: "",
  timelineType: "all",
  trackingMetric: "energy",
  trendMetric: "energy",      // métrica de la tendencia semanal del resumen
  activeSection: null,        // sección del mapa del cuerpo abierta
  activeZone: null,           // zona concreta abierta dentro de la sección
  data: emptyData()
};

export function emptyData() {
  return Object.fromEntries(APP_CONFIG.collections.map((name) => [name, []]));
}

export function normalizeData(data = {}) {
  const normalized = emptyData();
  APP_CONFIG.collections.forEach((name) => {
    normalized[name] = Array.isArray(data[name]) ? data[name] : [];
  });
  return normalized;
}

export function scopedData() {
  if (state.selectedProfileId === "all") return state.data;
  const scoped = emptyData();
  APP_CONFIG.collections.forEach((name) => {
    scoped[name] = name === "profiles"
      ? state.data.profiles.filter((profile) => profile.id === state.selectedProfileId)
      : (state.data[name] || []).filter((item) => item.profileId === state.selectedProfileId);
  });
  return scoped;
}

export function profileName(profileId) {
  return state.data.profiles.find((profile) => profile.id === profileId)?.name || "Sin perfil";
}

export function profileBadgeTone(profileId) {
  if (profileId === "profile-alek") return "alek";
  if (profileId === "profile-cata") return "cata";
  return "neutral";
}
