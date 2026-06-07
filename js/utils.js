// Utilidades puras y helpers de DOM. Sin estado de la app, sin Firebase.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function uid(prefix = "id") {
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clean(value) {
  return String(value || "").trim();
}

export function required(value, message) {
  const text = clean(value);
  if (!text) throw new Error(message);
  return text;
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// --- Fechas ---

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function calculateNextDate(dateString, months = 6) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  date.setMonth(date.getMonth() + Number(months || 0));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(dateString) {
  if (!dateString) return 9999;
  const target = new Date(`${dateString}T12:00:00`);
  const today = new Date(`${todayISO()}T12:00:00`);
  return Math.round((target - today) / 86400000);
}

export function daysSince(dateString) {
  if (!dateString) return 0;
  return Math.max(0, -daysBetween(dateString));
}

export function formatDate(dateString) {
  if (!dateString) return "Sin fecha";
  const normalized = String(dateString).includes("T") ? String(dateString) : `${dateString}T12:00:00`;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(normalized));
}

export function formatDateShort(dateString) {
  if (!dateString) return "S/F";
  return new Intl.DateTimeFormat("es-CO", { month: "short", day: "numeric" }).format(new Date(`${dateString}T12:00:00`));
}

export function formatDateTime(dateString) {
  if (!dateString) return "Sin fecha";
  const normalized = String(dateString).includes("T") ? String(dateString) : `${dateString}T12:00:00`;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(normalized));
}

// --- Ordenamiento ---

export function sortDesc(items, field) {
  return [...items].sort((a, b) => new Date(b?.[field] || 0) - new Date(a?.[field] || 0));
}

export function sortAsc(items, field) {
  return [...items].sort((a, b) => new Date(a?.[field] || 0) - new Date(b?.[field] || 0));
}

// --- Tonos / colores semánticos ---

export function toneByIntensity(value) {
  const number = Number(value || 0);
  if (number >= 7) return "danger";
  if (number >= 4) return "warning";
  return "success";
}

export function toneByPain(value) {
  const number = Number(value || 0);
  if (number >= 7) return "danger";
  if (number >= 3) return "warning";
  return "success";
}

// --- Toasts ---

let toastZone = null;
export function setToastZone(node) {
  toastZone = node;
}

export function toast(title, message, tone = "success") {
  if (!toastZone) return;
  const node = document.createElement("div");
  node.className = `toast ${tone}`;
  node.innerHTML = `<strong>${esc(title)}</strong><p>${esc(message)}</p>`;
  toastZone.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}
