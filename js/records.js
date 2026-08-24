// Definición de tipos de registro, navegación y formularios "schema-driven".
// Cada tipo describe sus campos como datos; un renderizador y un constructor
// genéricos producen el HTML y el objeto a guardar (sirve para crear y editar).

import {
  BODY_MAP,
  BODY_PARTS,
  CHECKUP_TYPES,
  FREQUENCY_OPTIONS,
  SPECIALTIES,
  STATUS_OPTIONS
} from "./config.js";
import {
  calculateNextDate,
  capitalize,
  clean,
  esc,
  required,
  todayISO,
  toNumber,
  uid
} from "./utils.js";
import { state } from "./state.js";

// Vistas de la barra inferior (máximo cinco, pensadas para el pulgar).
export const NAV_ITEMS = [
  { id: "dashboard", label: "Resumen", icon: "⌂", title: "Bienestar", subtitle: "Tu resumen de hoy" },
  { id: "tracking", label: "Seguimiento", icon: "◎", title: "Seguimiento", subtitle: "Tu día a día y cómo va cambiando" },
  { id: "appointments", label: "Citas", icon: "▤", title: "Citas", subtitle: "Consultas, controles y tratamientos" },
  { id: "timeline", label: "Historial", icon: "▥", title: "Historial", subtitle: "Todo lo que has registrado" },
  { id: "more", label: "Más", icon: "•••", title: "Más", subtitle: "Otras secciones de tu cuaderno" }
];

// Vistas secundarias, accesibles desde "Más".
export const MORE_ITEMS = [
  { id: "body", label: "Mapa del cuerpo", icon: "◎", title: "Mapa del cuerpo", subtitle: "Cómo va cada zona de tu cuerpo" },
  { id: "symptoms", label: "Síntomas", icon: "♡", title: "Síntomas", subtitle: "Molestias registradas y su evolución" },
  { id: "notes", label: "Notas", icon: "✎", title: "Notas", subtitle: "Observaciones y recordatorios" },
  { id: "data", label: "Datos personales", icon: "▣", title: "Tus datos", subtitle: "Tus registros y copias de seguridad" }
];

export const ALL_VIEWS = [...NAV_ITEMS, ...MORE_ITEMS];

export function viewMeta(id) {
  return ALL_VIEWS.find((item) => item.id === id) || NAV_ITEMS[0];
}

export const RECORD_TYPES = [
  { id: "daily", label: "Check-in", icon: "☀", hint: "Energía, sueño, agua y dolor" },
  { id: "symptom", label: "Síntoma", icon: "◌", hint: "Molestia o evolución" },
  { id: "body", label: "Cuerpo", icon: "◎", hint: "Parte del cuerpo específica" },
  { id: "appointment", label: "Cita", icon: "☉", hint: "Agenda médica" },
  { id: "checkup", label: "Control", icon: "✓", hint: "Chequeo periódico" },
  { id: "vitals", label: "Presión arterial", icon: "♥", hint: "Presión y pulso" },
  { id: "weight", label: "Peso", icon: "⚖", hint: "Peso y evolución" },
  { id: "treatment", label: "Tratamiento", icon: "✚", hint: "Medicamento o indicación" },
  { id: "note", label: "Nota", icon: "✎", hint: "Observación libre" }
];

export const COLLECTION_BY_TYPE = {
  daily: "dailyLogs",
  symptom: "symptoms",
  body: "bodyStatusEntries",
  appointment: "appointments",
  checkup: "checkups",
  treatment: "treatments",
  note: "notes",
  vitals: "vitals",
  weight: "weights"
};

const TYPE_BY_COLLECTION = Object.fromEntries(
  Object.entries(COLLECTION_BY_TYPE).map(([type, collection]) => [collection, type])
);

export function typeForCollection(collection) {
  return TYPE_BY_COLLECTION[collection] || "note";
}

export function typeLabel(type) {
  return RECORD_TYPES.find((item) => item.id === type)?.label || type;
}

export function preferredTypeForView() {
  return {
    dashboard: "daily",
    tracking: "daily",
    symptoms: "symptom",
    appointments: "appointment",
    timeline: "note",
    notes: "note",
    body: "body",
    vitals: "vitals",
    data: "note",
    more: "note"
  }[state.activeView] || "daily";
}

// Tipos que admiten adjuntos (exámenes, fórmulas, resultados).
export const ATTACHABLE_TYPES = new Set(["appointment", "checkup", "treatment"]);

// --- Esquemas de formulario ---

const MOOD_OPTIONS = ["estable", "feliz", "sensible", "cansado", "ansioso", "irritable"];
const TREATMENT_FREQUENCY = ["Diaria", "Cada 8 horas", "Cada 12 horas", "2 veces al día", "3 veces al día", "Semanal", "Según necesidad"];

const RECORD_SCHEMAS = {
  daily: [
    { name: "profileId", kind: "profile" },
    { name: "date", kind: "date", label: "Fecha de registro", required: true, requiredMsg: "Indica la fecha.", default: todayISO },
    { name: "energy", kind: "range", label: "Nivel de energía hoy (1 = Agotado, 10 = Pleno)", min: 1, max: 10, default: 6 },
    { name: "painLevel", kind: "range", label: "Nivel de dolor físico (0 = Sin dolor, 10 = Extremo)", min: 0, max: 10, default: 0 },
    { name: "sleepHours", kind: "number", label: "Horas de sueño (dormidas anoche)", min: 0, max: 24, step: 0.5, default: 7 },
    { name: "waterCups", kind: "number", label: "Agua (vasos de 250ml)", min: 0, max: 30, step: 1, default: 5 },
    { name: "movementMinutes", kind: "number", label: "Actividad física / Ejercicio (minutos)", min: 0, step: 5, default: 0 },
    { name: "mood", kind: "select", label: "Estado de ánimo predominante", options: MOOD_OPTIONS, default: "estable" },
    { name: "bodyPartsOk", kind: "bodyChecklist", label: "Chequeo rápido del cuerpo (Marcar si está BIEN)", full: true },
    { name: "note", kind: "textarea", label: "Nota o comentarios del día", full: true, placeholder: "Gatillos, avances, comida, descanso, emociones, contexto..." }
  ],
  symptom: [
    { name: "profileId", kind: "profile" },
    { name: "name", kind: "text", label: "Nombre del síntoma", required: true, requiredMsg: "Escribe el síntoma.", placeholder: "Ej. Migraña, acidez, fatiga" },
    { name: "bodyPart", kind: "zone", label: "Zona del cuerpo afectada", required: true, requiredMsg: "Elige una zona del cuerpo." },
    { name: "intensity", kind: "range", label: "Intensidad del síntoma (1 al 10)", min: 1, max: 10, default: 4 },
    { name: "duration", kind: "text", label: "Duración aproximada", required: true, requiredMsg: "Indica la duración.", placeholder: "Ej. 2 horas, todo el día" },
    { name: "frequency", kind: "select", label: "Frecuencia", options: FREQUENCY_OPTIONS, default: "Ocasional" },
    { name: "startDate", kind: "date", label: "Inicio", required: true, requiredMsg: "Indica la fecha de inicio.", default: todayISO },
    { name: "status", kind: "select", label: "Estado actual del síntoma", options: ["activo", "en observación", "mejorando", "resuelto"], default: "activo" },
    { name: "trend", kind: "select", label: "Evolución / Tendencia", options: ["igual", "mejorando", "empeorando", "intermitente"], default: "igual" },
    { name: "triggers", kind: "text", label: "Desencadenantes / Gatillos", full: true, placeholder: "Ej. Falta de sueño, estrés, cafeína, posturas" },
    { name: "notes", kind: "textarea", label: "Notas adicionales", full: true }
  ],
  body: [
    { name: "profileId", kind: "profile" },
    { name: "bodyPart", kind: "zone", label: "Zona del cuerpo bajo seguimiento", required: true, requiredMsg: "Elige una zona del cuerpo." },
    { name: "status", kind: "select", label: "Estado de esta zona", options: STATUS_OPTIONS, default: "En observación" },
    { name: "symptom", kind: "text", label: "Qué sientes en esta parte", required: true, requiredMsg: "Describe la molestia.", full: true, placeholder: "Qué se siente o qué cambió" },
    { name: "intensity", kind: "range", label: "Intensidad de la molestia (1 al 10)", min: 1, max: 10, default: 3 },
    { name: "frequency", kind: "select", label: "Frecuencia", options: FREQUENCY_OPTIONS, default: "Ocasional" },
    { name: "startDate", kind: "date", label: "Inicio", required: true, requiredMsg: "Indica la fecha de inicio.", default: todayISO },
    { name: "observations", kind: "textarea", label: "Notas adicionales u observaciones", full: true },
    { name: "requiresAppointment", kind: "checkbox", label: "¿Necesita consulta médica?" },
    { name: "reviewed", kind: "checkbox", label: "¿Ya fue revisado / atendido?" }
  ],
  appointment: [
    { name: "profileId", kind: "profile" },
    { name: "specialty", kind: "select", label: "Especialidad", options: SPECIALTIES, required: true, requiredMsg: "Elige la especialidad." },
    { name: "doctor", kind: "text", label: "Profesional", placeholder: "Opcional" },
    { name: "date", kind: "date", label: "Fecha", required: true, requiredMsg: "Indica la fecha.", default: todayISO },
    { name: "time", kind: "time", label: "Hora", required: true, requiredMsg: "Indica la hora.", default: "09:00" },
    { name: "location", kind: "text", label: "Lugar", placeholder: "Sede, dirección o link" },
    { name: "status", kind: "select", label: "Estado", options: ["agendada", "pendiente", "realizada", "cancelada"], default: "agendada" },
    { name: "bodyPart", kind: "zone", label: "Zona del cuerpo relacionada" },
    { name: "reason", kind: "text", label: "Motivo", required: true, requiredMsg: "Escribe el motivo.", full: true, placeholder: "Por qué se agenda" },
    { name: "notes", kind: "textarea", label: "Resultado / próximos pasos", full: true }
  ],
  checkup: [
    { name: "profileId", kind: "profile" },
    { name: "name", kind: "select", label: "Control", options: CHECKUP_TYPES, required: true, requiredMsg: "Elige el control." },
    { name: "frequencyMonths", kind: "number", label: "Frecuencia (meses)", min: 1, max: 60, step: 1, default: 6 },
    { name: "lastDoneDate", kind: "date", label: "Última vez", required: true, requiredMsg: "Indica la última vez.", default: todayISO },
    { name: "idealNextDate", kind: "date", label: "Próxima fecha ideal", default: (v) => v.idealNextDate || calculateNextDate(v.lastDoneDate || todayISO(), v.frequencyMonths || 6), coerce: (raw, fd) => raw || calculateNextDate(fd.lastDoneDate, fd.frequencyMonths) },
    { name: "status", kind: "select", label: "Estado", options: ["al día", "por vencer", "atrasado"], default: "al día" },
    { name: "priority", kind: "select", label: "Prioridad", options: ["baja", "media", "alta", "urgente"], default: "media" },
    { name: "bodyPart", kind: "zone", label: "Zona del cuerpo relacionada" },
    { name: "observations", kind: "textarea", label: "Observaciones", full: true }
  ],
  treatment: [
    { name: "profileId", kind: "profile" },
    { name: "medication", kind: "text", label: "Nombre", required: true, requiredMsg: "Escribe el tratamiento.", placeholder: "Medicamento, terapia o indicación" },
    { name: "dose", kind: "text", label: "Dosis / indicación", placeholder: "Ej. 1 tableta" },
    { name: "doctor", kind: "text", label: "Prescrito por", placeholder: "Opcional" },
    { name: "frequency", kind: "select", label: "Frecuencia", options: TREATMENT_FREQUENCY, default: "Diaria" },
    { name: "times", kind: "text", label: "Horarios", placeholder: "Ej. 8:00, 14:00, 20:00" },
    { name: "startDate", kind: "date", label: "Inicio", required: true, requiredMsg: "Indica el inicio.", default: todayISO },
    { name: "endDate", kind: "date", label: "Fin estimado" },
    { name: "bodyPart", kind: "zone", label: "Zona del cuerpo relacionada" },
    { name: "active", kind: "select", label: "Estado", options: ["activo", "pausado"], get: (v) => (v.active === false ? "pausado" : "activo"), coerce: (raw) => raw === "activo" },
    { name: "notes", kind: "textarea", label: "Notas", full: true }
  ],
  vitals: [
    { name: "profileId", kind: "profile" },
    { name: "date", kind: "date", label: "Fecha", required: true, requiredMsg: "Indica la fecha.", default: todayISO },
    { name: "time", kind: "time", label: "Hora", default: "08:00" },
    { name: "systolic", kind: "number", label: "Presión alta (sistólica)", min: 50, max: 260, step: 1, default: 120 },
    { name: "diastolic", kind: "number", label: "Presión baja (diastólica)", min: 30, max: 160, step: 1, default: 80 },
    { name: "pulse", kind: "number", label: "Pulso (latidos por minuto)", min: 30, max: 220, step: 1, default: 70 },
    { name: "moment", kind: "select", label: "Momento de la toma", options: ["En reposo", "Al despertar", "Antes de dormir", "Después de actividad", "Con molestia"], default: "En reposo" },
    { name: "arm", kind: "select", label: "Brazo", options: ["Izquierdo", "Derecho"], default: "Izquierdo" },
    { name: "notes", kind: "textarea", label: "Notas", full: true, placeholder: "Cómo te sentías, si tomaste algún medicamento..." }
  ],
  weight: [
    { name: "profileId", kind: "profile" },
    { name: "date", kind: "date", label: "Fecha", required: true, requiredMsg: "Indica la fecha.", default: todayISO },
    { name: "weightKg", kind: "number", label: "Peso (kg)", min: 1, max: 500, step: 0.1, required: true, requiredMsg: "Indica el peso en kilogramos." },
    { name: "time", kind: "time", label: "Hora" },
    { name: "notes", kind: "textarea", label: "Notas", full: true, placeholder: "Ej. En ayunas, después de ejercicio o alguna observación..." }
  ],
  note: [
    { name: "profileId", kind: "profile" },
    { name: "date", kind: "date", label: "Fecha", default: todayISO },
    { name: "category", kind: "select", label: "Categoría", options: ["Observación", "Pregunta médica", "Patrón", "Recordatorio", "Idea", "Otro"], default: "Observación" },
    { name: "bodyPart", kind: "zone", label: "Zona del cuerpo relacionada" },
    { name: "title", kind: "text", label: "Título", required: true, requiredMsg: "Escribe un título.", full: true, placeholder: "Título corto" },
    { name: "content", kind: "textarea", label: "Contenido", required: true, requiredMsg: "Escribe el contenido.", full: true }
  ]
};

export function schemaFor(type) {
  return RECORD_SCHEMAS[type] || RECORD_SCHEMAS.daily;
}

// --- Renderizado de formularios ---

function fieldCurrentValue(field, values) {
  if (typeof field.get === "function") return field.get(values || {});
  const current = values ? values[field.name] : undefined;
  if (current !== undefined && current !== null && current !== "") return current;
  return typeof field.default === "function" ? field.default(values || {}) : (field.default ?? "");
}

function renderField(field, values) {
  if (field.kind === "profile") return renderProfileField(values);

  const value = fieldCurrentValue(field, values);
  const fullClass = field.full ? "field full" : "field";
  const req = field.required ? "required" : "";

  switch (field.kind) {
    case "bodyChecklist":
      return renderBodyChecklist(values, true);
    case "zone":
      return `
        <label class="${fullClass}">
          <span>${esc(field.label)}</span>
          <select name="${field.name}" ${req}>
            ${field.required ? "" : `<option value="" ${value ? "" : "selected"}>Sin zona específica</option>`}
            ${BODY_MAP.map((section) => `
              <optgroup label="${esc(section.label)}">
                ${section.zones.map((zone) => `<option value="${esc(zone)}" ${String(value) === zone ? "selected" : ""}>${esc(zone)}</option>`).join("")}
              </optgroup>
            `).join("")}
          </select>
        </label>`;
    case "checkbox":
      return `<label class="${fullClass}"><span><input type="checkbox" name="${field.name}" ${values?.[field.name] ? "checked" : ""}> ${esc(field.label)}</span></label>`;
    case "range":
      return `
        <label class="field">
          <span>${esc(field.label)}</span>
          <div class="range-row">
            <input type="range" name="${field.name}" min="${field.min}" max="${field.max}" value="${esc(value)}">
            <strong class="range-value">${esc(value)}</strong>
          </div>
        </label>`;
    case "number":
      return `<label class="${fullClass}"><span>${esc(field.label)}</span><input type="number" name="${field.name}" ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""} ${field.step !== undefined ? `step="${field.step}"` : ""} value="${esc(value)}" ${req}></label>`;
    case "date":
      return `<label class="${fullClass}"><span>${esc(field.label)}</span><input type="date" name="${field.name}" value="${esc(value)}" ${req}></label>`;
    case "time":
      return `<label class="${fullClass}"><span>${esc(field.label)}</span><input type="time" name="${field.name}" value="${esc(value)}" ${req}></label>`;
    case "textarea":
      return `<label class="${fullClass}"><span>${esc(field.label)}</span><textarea name="${field.name}" placeholder="${esc(field.placeholder || "")}" ${req}>${esc(value)}</textarea></label>`;
    case "select":
      return `<label class="${fullClass}"><span>${esc(field.label)}</span><select name="${field.name}">${field.options.map((option) => `<option value="${esc(option)}" ${String(value) === String(option) ? "selected" : ""}>${esc(capitalize(option))}</option>`).join("")}</select></label>`;
    case "text":
    default:
      return `<label class="${fullClass}"><span>${esc(field.label)}</span><input type="text" name="${field.name}" value="${esc(value)}" placeholder="${esc(field.placeholder || "")}" ${req}></label>`;
  }
}

export function renderBodyChecklist(values = null, isOpen = true) {
  const currentOk = values?.bodyPartsOk;
  const isNew = !values;
  const total = BODY_PARTS.length;
  const checkedCount = isNew ? total : (currentOk ? currentOk.length : 0);
  
  let summaryText = "";
  let summaryClass = "";
  if (checkedCount === total) {
    summaryText = `Todos Bien (${total}/${total})`;
    summaryClass = "success";
  } else if (checkedCount === 0) {
    summaryText = `Todas con novedad (0/${total})`;
    summaryClass = "danger";
  } else {
    summaryText = `${checkedCount}/${total} Bien (novedad en ${total - checkedCount})`;
    summaryClass = "warning";
  }

  const options = BODY_PARTS.map((part) => {
    const isChecked = isNew ? true : (currentOk && currentOk.includes(part));
    return `
      <label class="body-check-pill ${isChecked ? "checked" : ""}">
        <input type="checkbox" name="bodyPartsOk" value="${esc(part)}" ${isChecked ? "checked" : ""} onchange="this.parentElement.classList.toggle('checked', this.checked); this.parentElement.querySelector('.status-indicator').textContent = this.checked ? '✓ Bien' : '⚠ Novedad'; updateBodyChecklistSummary(this);">
        <span>${esc(part)}</span>
        <span class="status-indicator">${isChecked ? "✓ Bien" : "⚠ Novedad"}</span>
      </label>
    `;
  }).join("");

  return `
    <details class="field full body-checklist-details" ${isOpen ? "open" : ""}>
      <summary class="body-checklist-summary" onclick="setTimeout(() => updateBodyChecklistSummary(this.querySelector('input') || this.nextElementSibling?.querySelector('input')), 50)">
        <span>🩺 Chequeo rápido de cuerpo (Marcar si está BIEN)</span>
        <strong class="summary-status ${summaryClass}">${summaryText}</strong>
      </summary>
      <div class="body-checklist-field">
        <div class="checklist-header">
          <span class="field-hint">Desmarca las partes del cuerpo que tengan alguna novedad.</span>
          <div class="checklist-actions">
            <button type="button" class="mini-button success" onclick="toggleAllBodyParts(this, true)">Todo BIEN</button>
            <button type="button" class="mini-button neutral" onclick="toggleAllBodyParts(this, false)">Ninguno</button>
          </div>
        </div>
        <div class="body-checklist-grid">
          ${options}
        </div>
      </div>
    </details>
  `;
}

function renderProfileField(values) {
  const fallback = state.selectedProfileId !== "all" ? state.selectedProfileId : (state.data.profiles[0]?.id || "profile-alek");
  const selected = values?.profileId || fallback;
  return `
    <label class="field">
      <span>Perfil</span>
      <select name="profileId" required>
        ${state.data.profiles.map((profile) => `<option value="${esc(profile.id)}" ${selected === profile.id ? "selected" : ""}>${esc(profile.name)}</option>`).join("")}
      </select>
    </label>`;
}

export function renderRecordForm(type, values = null) {
  const schema = schemaFor(type);
  const attachmentsField = ATTACHABLE_TYPES.has(type)
    ? `<label class="field full"><span>Adjuntar exámenes / fórmulas</span><input type="file" name="attachments" multiple accept="image/*,application/pdf"></label>`
    : "";

  return `
    <form id="recordForm" class="form-grid" data-record-type="${type}">
      ${schema.map((field) => renderField(field, values)).join("")}
      ${attachmentsField}
      <div class="field full form-actions">
        <button type="button" class="ghost-button" data-action="close-dialog">Cancelar</button>
        <button type="submit" class="primary-button">${values ? "Guardar cambios" : "Guardar registro"}</button>
      </div>
    </form>`;
}

// --- Construcción del registro a partir del formulario ---

function readField(field, formData) {
  const raw = formData[field.name];
  if (field.kind === "bodyChecklist") {
    return Array.isArray(raw) ? raw : (raw ? [raw] : []);
  }
  if (field.kind === "checkbox") return raw !== undefined;
  if (field.kind === "number" || field.kind === "range") {
    return toNumber(raw, typeof field.default === "number" ? field.default : 0);
  }
  if (field.required) return required(raw, field.requiredMsg || `Completa: ${field.label}.`);
  if (typeof field.coerce === "function") return field.coerce(raw, formData);
  return clean(raw);
}

export function buildRecord(type, formData, existing = null) {
  const schema = schemaFor(type);
  const now = new Date().toISOString();
  const record = existing ? { ...existing } : { id: uid(type), createdAt: now };
  record.updatedAt = now;
  record.profileId = required(formData.profileId, "Selecciona un perfil.");

  schema.forEach((field) => {
    if (field.kind === "profile") return;
    record[field.name] = readField(field, formData);
  });

  return record;
}
