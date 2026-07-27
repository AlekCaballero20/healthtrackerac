// Funciones de presentación: reciben el estado/datos y devuelven HTML.
// No mutan estado ni hablan con Firebase (eso vive en app.js / firebase.js).

import { APP_CONFIG, BODY_PARTS } from "./config.js";
import { isDemoMode } from "./firebase.js";
import {
  daysBetween,
  daysSince,
  esc,
  formatDate,
  formatDateShort,
  formatDateTime,
  sortAsc,
  sortDesc,
  todayISO,
  toneByIntensity,
  toneByPain
} from "./utils.js";
import { profileBadgeTone, profileName, scopedData, state } from "./state.js";
import {
  activeSymptoms,
  appointmentTone,
  buildTimeline,
  computeAlerts,
  dosesThisWeek,
  dosesToday,
  bpAverage,
  bpLevel,
  bpSeries,
  bodyMapSummary,
  dueCheckups,
  lastDose,
  lastSymptomDate,
  metricSeries,
  nextAppointment,
  pendingCheckups,
  recordsForZone,
  sortedVitals,
  trendLabel,
  zoneStatus,
  latestVitals,
  upcomingAppointments,
  weekSeries
} from "./domain.js";
import { MORE_ITEMS, typeLabel, renderBodyChecklist } from "./records.js";

// --- Bloques genéricos ---

export function metric(label, value, hint) {
  return `<article class="metric-card"><div class="metric-value">${esc(value)}</div><div class="metric-label">${esc(label)}</div><div class="metric-hint">${esc(hint || "")}</div></article>`;
}

function miniMetric(label, value) {
  return `<span class="pill neutral"><strong>${esc(label)}:</strong> ${esc(value)}</span>`;
}

export function emptyState(title, copy) {
  return `<div class="empty-state"><h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;
}

function editButton(collection, id) {
  return `<button type="button" class="ghost-button" data-action="edit-record" data-collection="${esc(collection)}" data-id="${esc(id)}">Editar</button>`;
}

function deleteButton(collection, id) {
  return `<button type="button" class="danger-button" data-action="delete-record" data-collection="${esc(collection)}" data-id="${esc(id)}">Eliminar</button>`;
}

function renderAttachments(collection, item) {
  const list = item.attachments || [];
  if (!list.length) return "";
  return `
    <div class="attachment-list">
      ${list.map((file, index) => `
        <span class="attachment-chip">
          <a href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">📎 ${esc(file.name || "Archivo")}</a>
          <button type="button" class="attachment-remove" data-action="remove-attachment" data-collection="${esc(collection)}" data-id="${esc(item.id)}" data-index="${index}" aria-label="Quitar adjunto">×</button>
        </span>
      `).join("")}
    </div>`;
}

// --- Estados de carga / sesión ---

export function renderLoading() {
  return `<section class="empty-state"><h3>Un momento</h3><p>Estamos abriendo tu información.</p></section>`;
}

export function renderAuthState() {
  return `
    <section class="empty-state">
      <h3>Este es tu espacio privado</h3>
      <p>Ingresa con tu cuenta para ver tu seguimiento de bienestar.</p>
      <div class="form-actions"><button type="button" class="primary-button" data-auth="login">Ingresar</button></div>
    </section>`;
}

export function renderBlockedState() {
  return `
    <section class="empty-state">
      <h3>Esta cuenta no tiene acceso</h3>
      <p>Cierra sesión e ingresa con una cuenta autorizada.</p>
      <div class="form-actions"><button type="button" class="ghost-button" data-auth="logout">Cerrar sesión</button></div>
    </section>`;
}

export function renderErrorState() {
  return `
    <section class="empty-state">
      <h3>No pudimos cargar tu información</h3>
      <p>Revisa tu conexión e inténtalo de nuevo.</p>
      <div class="form-actions"><button type="button" class="primary-button" data-action="reload">Reintentar</button></div>
    </section>`;
}

// --- Check-in rápido ---

export function renderQuickCheckin() {
  const today = todayISO();
  const profileOptions = state.data.profiles.map((profile) => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join("");
  return `
    <section class="quick-panel">
      <div class="panel-header">
        <div>
          <h3>¿Cómo va tu día?</h3>
          <p class="section-subtitle">Un registro corto para no perder el hilo de cómo te sientes.</p>
        </div>
        <button type="button" class="soft-button" data-action="open-create" data-type="daily">Registro completo</button>
      </div>
      <form id="quickCheckinForm" class="quick-grid">
        <label class="field"><span>Perfil</span><select name="profileId" required>${profileOptions}</select></label>
        <label class="field"><span>Fecha de registro</span><input type="date" name="date" value="${today}" required></label>
        <label class="field">
          <span>Energía (1-10)</span>
          <small class="field-hint">1: Agotado, 10: Pleno</small>
          <div class="range-row"><input type="range" name="energy" min="1" max="10" value="6"><strong class="range-value">6</strong></div>
        </label>
        <label class="field">
          <span>Dolor físico (0-10)</span>
          <small class="field-hint">0: Sin dolor, 10: Severo</small>
          <div class="range-row"><input type="range" name="painLevel" min="0" max="10" value="0"><strong class="range-value">0</strong></div>
        </label>
        <label class="field">
          <span>Horas de sueño</span>
          <small class="field-hint">Dormidas anoche</small>
          <input type="number" name="sleepHours" min="0" max="24" step="0.5" value="7">
        </label>
        <label class="field">
          <span>Estado de ánimo</span>
          <small class="field-hint">¿Cómo te sientes hoy?</small>
          <select name="mood">
            <option value="estable">Estable</option>
            <option value="feliz">Feliz</option>
            <option value="sensible">Sensible</option>
            <option value="cansado">Cansado</option>
            <option value="ansioso">Ansioso</option>
            <option value="irritable">Irritable</option>
          </select>
        </label>
        ${renderBodyChecklist(null, false)}
        <label class="field full"><span>Nota corta del día</span><input name="note" placeholder="Algo importante del día: cómo dormiste, cómo te sentiste..."></label>
        <div class="field full form-actions"><button type="submit" class="primary-button full">Guardar registro</button></div>
      </form>
    </section>`;
}

// --- Íconos (trazos finos, coherentes con el resto) ---

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01"/><path d="M15 9.5h.01"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>'),
  clipboard: svg('<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9z"/><path d="M9 12l2 2 3.5-3.5"/>'),
  calendar: svg('<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9.5 15l1.5 1.5 3-3"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  heartPlus: svg('<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/><path d="M12 11h.01"/>'),
  note: svg('<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H16l3 3v13.5A2.5 2.5 0 0 1 16.5 22h-9A2.5 2.5 0 0 1 5 19.5Z"/><path d="M9 12h6M9 16h4"/>'),
  pill: svg('<rect x="5" y="3" width="14" height="18" rx="4"/><path d="M5 10h14"/>'),
  head: svg('<path d="M15 21v-2.5c0-1 .5-1.6 1.3-2.2A6.5 6.5 0 1 0 6 10.6"/><path d="M6 11H4.5L6 14H5v3h4v4"/>'),
  chart: svg('<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>')
};

// --- Resumen (pantalla principal) ---

export function renderDashboard() {
  const data = scopedData();
  const alerts = computeAlerts(data);

  return `
    <section class="stack">
      ${renderDayStatus(data, alerts)}

      <section>
        <h2 class="section-title" style="margin-bottom:10px">Acciones rápidas</h2>
        ${renderQuickActions()}
      </section>

      ${renderTodaySummary(data)}
      ${renderWeekTrend(data)}
    </section>`;
}

function renderDayStatus(data, alerts) {
  const worst = alerts.some((item) => item.level === "danger")
    ? "alert"
    : alerts.length ? "attention" : "ok";

  const title = { ok: "Todo va bien", attention: "Hay algo por revisar", alert: "Necesita tu atención" }[worst];
  const copy = alerts.length
    ? `${alerts.length} aviso${alerts.length > 1 ? "s" : ""} para mirar hoy`
    : "No tienes avisos importantes";

  const pending = pendingCheckups(data).length;
  const next = nextAppointment(data);
  const lastSymptom = lastSymptomDate(data);
  const days = lastSymptom === null ? null : daysSince(lastSymptom);

  return `
    <section class="hero-card ${worst === "ok" ? "" : worst}">
      <div class="hero-top">
        <div class="hero-face">${worst === "ok" ? ICONS.smile : ICONS.alert}</div>
        <div>
          <p class="hero-title">${esc(title)}</p>
          <p class="hero-copy">${esc(copy)}</p>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-icon">${ICONS.clipboard}</div>
          <strong>${pending ? pending : "—"}</strong>
          <small>${pending ? `seguimiento${pending > 1 ? "s" : ""} pendiente${pending > 1 ? "s" : ""}` : "No tienes seguimientos pendientes"}</small>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-icon">${ICONS.calendar}</div>
          <strong>${next ? esc(formatDateShort(next.date)) : "—"}</strong>
          <small>${next ? "Próxima cita" : "No tienes citas próximas"}</small>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-icon">${ICONS.heart}</div>
          <strong>${days === null ? "—" : (days === 0 ? "Hoy" : `Hace ${days} día${days > 1 ? "s" : ""}`)}</strong>
          <small>${days === null ? "Aún no has registrado síntomas" : "Último síntoma"}</small>
        </div>
      </div>
    </section>`;
}

const QUICK_ACTIONS = [
  { type: "symptom", label: "Registrar<br>síntoma", icon: ICONS.plus, tone: "" },
  { type: "vitals", label: "Agregar<br>medición", icon: ICONS.heartPlus, tone: "green" },
  { type: "appointment", label: "Agendar<br>cita", icon: ICONS.calendar, tone: "amber" },
  { type: "note", label: "Nueva<br>nota", icon: ICONS.note, tone: "" }
];

function renderQuickActions() {
  return `
    <div class="quick-actions">
      ${QUICK_ACTIONS.map((action) => `
        <button type="button" class="qa-button" data-action="open-create" data-type="${action.type}">
          <span class="qa-icon ${action.tone}">${action.icon}</span>
          <span class="qa-label">${action.label}</span>
        </button>
      `).join("")}
    </div>`;
}

function summaryRow({ view, tone = "", icon, title, detail, when }) {
  return `
    <button type="button" class="summary-row ${tone ? `tone-${tone}` : ""}" data-view="${view}">
      <span class="summary-icon ${tone ? `tone-${tone}` : ""}">${icon}</span>
      <span class="summary-text"><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>
      <span class="summary-when">${esc(when || "")}</span>
      <span class="summary-chevron" aria-hidden="true">›</span>
    </button>`;
}

function renderTodaySummary(data) {
  const rows = [];

  const treatments = data.treatments.filter((item) => item.active);
  if (treatments.length) {
    const first = treatments[0];
    rows.push(summaryRow({
      view: "appointments",
      icon: ICONS.pill,
      title: "Medicamentos",
      detail: treatments.length === 1 ? `${first.medication}${first.dose ? ` · ${first.dose}` : ""}` : `${treatments.length} en curso`,
      when: first.times ? String(first.times).split(",")[0].trim() : ""
    }));
  }

  const symptom = sortDesc(data.symptoms, "startDate")[0];
  if (symptom) {
    rows.push(summaryRow({
      view: "symptoms",
      tone: toneByIntensity(symptom.intensity),
      icon: ICONS.head,
      title: "Síntomas recientes",
      detail: `${symptom.name}${symptom.bodyPart ? ` · ${symptom.bodyPart}` : ""}`,
      when: relativeDay(symptom.startDate)
    }));
  }

  const checkups = pendingCheckups(data);
  if (checkups.length) {
    const first = sortAsc(checkups, "idealNextDate")[0];
    rows.push(summaryRow({
      view: "appointments",
      tone: daysBetween(first.idealNextDate) < 0 ? "warning" : "",
      icon: ICONS.clipboard,
      title: "Seguimientos activos",
      detail: checkups.length === 1 ? first.name : `${checkups.length} controles por hacer`,
      when: first.frequencyMonths ? `Cada ${first.frequencyMonths} meses` : ""
    }));
  }

  const next = nextAppointment(data);
  if (next) {
    rows.push(summaryRow({
      view: "appointments",
      icon: ICONS.calendar,
      title: "Próximas citas",
      detail: `${next.specialty}${next.reason ? ` · ${next.reason}` : ""}`,
      when: `${formatDateShort(next.date)}${next.time ? ` · ${next.time}` : ""}`
    }));
  }

  const bp = latestVitals(data);
  if (bp) {
    const level = bpLevel(bp.systolic, bp.diastolic);
    rows.push(summaryRow({
      view: "tracking",
      tone: level && level.tone !== "success" ? level.tone : "",
      icon: ICONS.heart,
      title: "Presión arterial",
      detail: `${bp.systolic}/${bp.diastolic} mmHg${level ? ` · ${level.label}` : ""}`,
      when: relativeDay(bp.date)
    }));
  }

  const note = sortDesc(data.notes, "createdAt")[0];
  if (note) {
    rows.push(summaryRow({
      view: "notes",
      icon: ICONS.note,
      title: "Notas recientes",
      detail: note.title || note.content || "Nota",
      when: relativeDay(note.date || note.createdAt)
    }));
  }

  if (!rows.length) {
    return `
      <section>
        <h2 class="section-title" style="margin-bottom:10px">Resumen de hoy</h2>
        ${emptyState("Todavía no hay nada que mostrar", "Usa las acciones rápidas para hacer tu primer registro.")}
      </section>`;
  }

  return `
    <section>
      <div class="section-header" style="margin-bottom:10px">
        <h2 class="section-title">Resumen de hoy</h2>
        <button type="button" class="link-button" data-view="timeline">Ver todo ›</button>
      </div>
      <div class="summary-list">${rows.join("")}</div>
    </section>`;
}

function relativeDay(dateString) {
  if (!dateString) return "";
  const diff = daysBetween(String(dateString).slice(0, 10));
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  if (diff === 1) return "Mañana";
  return formatDateShort(String(dateString).slice(0, 10));
}

// Métricas de la tendencia semanal del resumen (incluye la presión arterial).
const TREND_METRICS = [
  { id: "energy", label: "Energía", max: 10, unit: "/10", source: "daily" },
  { id: "painLevel", label: "Dolor", max: 10, unit: "/10", source: "daily" },
  { id: "sleepHours", label: "Sueño", max: 12, unit: " h", source: "daily" },
  { id: "bloodPressure", label: "Presión", max: 160, min: 40, unit: "", source: "vitals" }
];

// Gráfica de línea sencilla, dibujada con SVG (sin librerías externas).
function renderWeekTrend(data) {
  const meta = TREND_METRICS.find((item) => item.id === state.trendMetric) || TREND_METRICS[0];
  const series = meta.source === "vitals" ? bpSeries(data) : weekSeries(data.dailyLogs, meta.id);
  const trend = trendLabel(series);

  const body = series.length < 2
    ? emptyState("Aún no hay suficientes datos", "Registra más datos para ver tu tendencia semanal.")
    : `<div class="trend-scroll">${lineChart(series, meta)}</div>`;

  return `
    <section class="panel trend-card">
      <div class="section-header">
        <h2 class="section-title">Tendencia de esta semana</h2>
        ${trend ? `<span class="trend-tag ${trend.tone === "success" ? "" : "warning"}">${esc(trend.text)}</span>` : ""}
      </div>
      <div class="chart-tabs">
        ${TREND_METRICS.map((item) => `<button type="button" class="chip ${item.id === meta.id ? "active" : ""}" data-action="set-trend-metric" data-metric="${item.id}">${esc(item.label)}</button>`).join("")}
      </div>
      ${body}
      ${meta.source === "vitals" && series.length > 1 ? `<p class="section-subtitle">Línea llena: presión alta. Línea punteada: presión baja.</p>` : ""}
    </section>`;
}

function lineChart(series, meta) {
  const width = 320;
  const height = 150;
  const padLeft = 26;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 24;
  const lows = series.map((point) => point.low).filter((value) => Number.isFinite(value));
  const max = Math.max(meta.max, ...series.map((point) => point.value));
  const min = meta.min ?? 0;
  const stepX = (width - padLeft - padRight) / Math.max(1, series.length - 1);
  const toY = (value) => padTop + (1 - (value - min) / (max - min || 1)) * (height - padTop - padBottom);

  const points = series.map((point, index) => ({
    x: padLeft + index * stepX,
    y: toY(point.value),
    label: formatDateShort(point.date),
    last: index === series.length - 1
  }));

  const lowPoints = lows.length === series.length
    ? series.map((point, index) => ({ x: padLeft + index * stepX, y: toY(point.low) }))
    : [];

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(min + ratio * (max - min)));

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="Evolución de ${esc(meta.label)} en los últimos días">
      ${ticks.map((tick) => `
        <line class="grid-line" x1="${padLeft}" x2="${width - padRight}" y1="${toY(tick).toFixed(1)}" y2="${toY(tick).toFixed(1)}"/>
        <text class="axis-text" x="0" y="${(toY(tick) + 3).toFixed(1)}">${tick}</text>
      `).join("")}
      <polyline class="series-line" points="${points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}"/>
      ${lowPoints.length ? `
        <polyline class="series-line low" points="${lowPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}"/>
        ${lowPoints.map((point) => `<circle class="series-dot low" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.6"/>`).join("")}` : ""}
      ${points.map((point) => `<circle class="series-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3"/>`).join("")}
      ${points.map((point) => `<text class="axis-text ${point.last ? "today" : ""}" x="${point.x.toFixed(1)}" y="${height - 6}" text-anchor="middle">${esc(point.last ? "Hoy" : point.label)}</text>`).join("")}
    </svg>`;
}

// --- Avisos (hoja del icono de campana) ---

export function renderAlertsList() {
  const alerts = computeAlerts(scopedData());
  if (!alerts.length) {
    return emptyState("Todo va bien", "No tienes avisos importantes por ahora.");
  }
  return `<div class="cards-grid">${alerts.map(renderAlert).join("")}</div>`;
}

function renderAlert(alert) {
  return `
    <article class="alert-card ${alert.level}">
      <div class="record-header">
        <strong>${esc(alert.title)}</strong>
        <span class="badge ${alert.level}">${esc(alert.profileName)}</span>
      </div>
      <p>${esc(alert.description)}</p>
    </article>`;
}

// --- Seguimiento diario + gráficas ---

const CHART_METRICS = [
  { id: "energy", label: "Energía", max: 10, unit: "/10" },
  { id: "painLevel", label: "Dolor", max: 10, unit: "/10" },
  { id: "sleepHours", label: "Sueño", max: 12, unit: " h" }
];

export function renderTracking() {
  const data = scopedData();
  const logs = sortDesc(data.dailyLogs, "date");
  const activeMetric = CHART_METRICS.find((m) => m.id === state.trackingMetric) || CHART_METRICS[0];
  const series = metricSeries(data.dailyLogs, activeMetric.id);

  const byProfile = state.data.profiles.map((profile) => {
    const profileLogs = sortDesc(data.dailyLogs.filter((log) => log.profileId === profile.id), "date");
    return { profile, latest: profileLogs[0], total: profileLogs.length };
  });

  return `
    <section class="stack">
      <section class="panel chart-card">
        <div class="section-header">
          <h2 class="section-title">Cómo has estado</h2>
          <button type="button" class="primary-button" data-action="open-create" data-type="daily">Nuevo check-in</button>
        </div>
        <div class="chart-tabs">
          ${CHART_METRICS.map((m) => `<button type="button" class="chip ${m.id === activeMetric.id ? "active" : ""}" data-action="set-chart-metric" data-metric="${m.id}">${esc(m.label)}</button>`).join("")}
        </div>
        ${series.length ? renderMetricChart(series, activeMetric) : emptyState("Aún no hay registros", "Guarda algunos registros diarios y aquí verás tu evolución.")}
      </section>

      <section class="cards-grid">
        ${byProfile.map(({ profile, latest, total }) => `
          <article class="record-card">
            <div class="record-header">
              <div><h3>${esc(profile.name)}</h3><p>${esc(profile.shortGoal || "Seguimiento general")}</p></div>
              <span class="badge ${profileBadgeTone(profile.id)}">${total} registros</span>
            </div>
            ${latest ? `
              <div class="mini-grid">
                ${metric("Energía", latest.energy ?? "-", "último")}
                ${metric("Dolor", latest.painLevel ?? "-", "último")}
                ${metric("Sueño", latest.sleepHours ?? "-", "horas")}
              </div>
              <p>${esc(latest.note || "Sin nota adicional")}</p>
            ` : `<p class="muted-copy">Sin registros todavía.</p>`}
          </article>
        `).join("")}
      </section>

      ${renderVitalsPanel(data)}

      <section class="panel">
        <div class="section-header"><h2 class="section-title">Registros recientes</h2></div>
        ${logs.length ? `<div class="timeline-grid">${logs.slice(0, 12).map(renderDailyLogCard).join("")}</div>` : emptyState("Nada registrado todavía", "Usa el botón de arriba para guardar tu primer registro del día.")}
      </section>
    </section>`;
}

function renderMetricChart(series, meta) {
  const tone = (value) => (meta.id === "painLevel" ? toneByPain(value) : meta.id === "energy" ? (value >= 6 ? "success" : value >= 3 ? "warning" : "danger") : "info");
  return `
    <div class="bars">
      ${series.map(({ date, value }) => `
        <div class="bar-row">
          <span>${formatDateShort(date)}</span>
          <div class="bar-track"><div class="bar-fill tone-${tone(value)}" style="width:${Math.max(2, Math.min(100, (value / meta.max) * 100))}%"></div></div>
          <strong>${value}${esc(meta.unit)}</strong>
        </div>
      `).join("")}
    </div>`;
}

function renderDailyLogCard(log) {
  const totalParts = BODY_PARTS.length;
  let bodySummaryHtml = "";
  if (log.bodyPartsOk) {
    const okCount = log.bodyPartsOk.length;
    if (okCount === totalParts) {
      bodySummaryHtml = `<div class="log-body-status success">Cuerpo: Todo Bien ✓</div>`;
    } else {
      const details = BODY_PARTS.filter((p) => !log.bodyPartsOk.includes(p)).join(", ");
      bodySummaryHtml = `<div class="log-body-status warning">Cuerpo: ${okCount}/${totalParts} Bien <span class="novedades-list">(novedad en: ${esc(details)})</span></div>`;
    }
  }

  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(profileName(log.profileId))}</strong><p>${formatDate(log.date)}</p></div>
        <span class="badge ${toneByPain(log.painLevel)}">Dolor ${log.painLevel ?? 0}/10</span>
      </div>
      <div class="mini-grid">
        ${miniMetric("Energía", log.energy ?? "-")}
        ${miniMetric("Sueño", `${log.sleepHours ?? "-"} h`)}
        ${miniMetric("Agua", log.waterCups ?? "-")}
      </div>
      ${bodySummaryHtml}
      <p>${esc(log.note || "Sin nota")}</p>
      <div class="card-actions">${editButton("dailyLogs", log.id)}${deleteButton("dailyLogs", log.id)}</div>
    </article>`;
}

// --- Síntomas ---

export function renderSymptoms() {
  const data = scopedData();
  const symptoms = sortDesc(data.symptoms, "createdAt");
  const body = sortDesc(data.bodyStatusEntries, "createdAt");

  return `
    <section class="stack">
      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">Molestias y evolución</h2>
          <div class="card-actions">
            <button type="button" class="ghost-button" data-action="open-create" data-type="body">Registrar cuerpo</button>
            <button type="button" class="primary-button" data-action="open-create" data-type="symptom">Nuevo síntoma</button>
          </div>
        </div>
        ${symptoms.length ? `<div class="cards-grid">${symptoms.map(renderSymptomCard).join("")}</div>` : emptyState("Aún no has registrado síntomas", "Cuando algo te moleste, regístralo aquí para seguir su evolución.")}
      </section>

      <section class="panel">
        <div class="section-header"><h2 class="section-title">Partes del cuerpo en seguimiento</h2></div>
        ${body.length ? `<div class="cards-grid">${body.map(renderBodyCard).join("")}</div>` : emptyState("Sin registros del cuerpo", "Puedes seguir una zona concreta cuando necesite atención especial.")}
      </section>
    </section>`;
}

function renderSymptomCard(item) {
  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(item.name)}</strong><p>${esc(item.bodyPart)} · desde ${formatDate(item.startDate)}</p></div>
        <span class="badge ${toneByIntensity(item.intensity)}">${esc(item.intensity)}/10</span>
      </div>
      <p>${esc(item.notes || item.triggers || "Sin notas")}</p>
      <div class="record-meta">
        <span class="pill neutral">${esc(item.frequency || "Sin frecuencia")}</span>
        <span class="pill ${item.status === "resuelto" ? "success" : "warning"}">${esc(item.status || "activo")}</span>
      </div>
      <div class="card-actions">
        ${item.status !== "resuelto" ? `<button type="button" class="soft-button" data-action="set-status" data-collection="symptoms" data-id="${esc(item.id)}" data-status="resuelto">Marcar resuelto</button>` : ""}
        ${editButton("symptoms", item.id)}${deleteButton("symptoms", item.id)}
      </div>
    </article>`;
}

function renderBodyCard(item) {
  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(item.bodyPart)}</strong><p>${esc(item.status)} · ${formatDate(item.startDate)}</p></div>
        <span class="badge ${toneByIntensity(item.intensity)}">${esc(item.intensity)}/10</span>
      </div>
      <p>${esc(item.symptom || item.observations || "Sin detalle")}</p>
      <div class="record-meta">
        ${item.requiresAppointment ? `<span class="pill warning">requiere cita</span>` : ""}
        ${item.reviewed ? `<span class="pill success">revisado</span>` : `<span class="pill neutral">pendiente</span>`}
      </div>
      <div class="card-actions">${editButton("bodyStatusEntries", item.id)}${deleteButton("bodyStatusEntries", item.id)}</div>
    </article>`;
}

// --- Citas, controles y tratamientos ---

export function renderAppointments() {
  const data = scopedData();
  const appointments = sortAsc(data.appointments, "date");
  const checkups = sortAsc(data.checkups, "idealNextDate");
  const treatments = sortDesc(data.treatments, "createdAt");

  return `
    <section class="stack">
      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">Citas médicas</h2>
          <button type="button" class="primary-button" data-action="open-create" data-type="appointment">Nueva cita</button>
        </div>
        ${appointments.length ? `<div class="cards-grid">${appointments.map(renderAppointmentCard).join("")}</div>` : emptyState("No tienes citas próximas", "Agenda aquí tus consultas para tenerlas siempre a la mano.")}
      </section>

      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">Controles periódicos</h2>
          <button type="button" class="ghost-button" data-action="open-create" data-type="checkup">Nuevo control</button>
        </div>
        ${checkups.length ? `<div class="cards-grid">${checkups.map(renderCheckupCard).join("")}</div>` : emptyState("No tienes seguimientos pendientes", "Agrega odontología, exámenes, visión o cualquier control que se repita.")}
      </section>

      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">Medicamentos e indicaciones</h2>
          <button type="button" class="ghost-button" data-action="open-create" data-type="treatment">Nuevo tratamiento</button>
        </div>
        ${treatments.length ? `<div class="cards-grid">${treatments.map(renderTreatmentCard).join("")}</div>` : emptyState("Sin tratamientos activos", "Aquí puedes guardar medicamentos, terapias o indicaciones temporales.")}
      </section>
    </section>`;
}

function renderAppointmentCard(item) {
  const tone = appointmentTone(item);
  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(item.specialty)}</strong><p>${formatDate(item.date)} · ${esc(item.time || "")}</p></div>
        <span class="badge ${tone}">${esc(item.status || "agendada")}</span>
      </div>
      <p><strong>Motivo:</strong> ${esc(item.reason || "Sin motivo")}</p>
      ${item.doctor ? `<p><strong>Profesional:</strong> ${esc(item.doctor)}</p>` : ""}
      ${item.location ? `<p><strong>Lugar:</strong> ${esc(item.location)}</p>` : ""}
      ${item.notes ? `<p>${esc(item.notes)}</p>` : ""}
      ${renderAttachments("appointments", item)}
      <div class="card-actions">
        ${item.status !== "realizada" ? `<button type="button" class="soft-button" data-action="set-status" data-collection="appointments" data-id="${esc(item.id)}" data-status="realizada">Realizada</button>` : ""}
        ${item.status !== "cancelada" ? `<button type="button" class="ghost-button" data-action="set-status" data-collection="appointments" data-id="${esc(item.id)}" data-status="cancelada">Cancelar</button>` : ""}
        ${editButton("appointments", item.id)}${deleteButton("appointments", item.id)}
      </div>
    </article>`;
}

function renderCheckupCard(item) {
  const days = Math.round((new Date(`${item.idealNextDate || todayISO()}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000);
  const tone = item.status === "atrasado" || days < 0 ? "warning" : days <= 15 ? "info" : "success";
  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(item.name)}</strong><p>Próximo: ${formatDate(item.idealNextDate)}</p></div>
        <span class="badge ${tone}">${esc(item.status || "al día")}</span>
      </div>
      <p>${esc(item.observations || `Frecuencia: cada ${item.frequencyMonths || "?"} meses`)}</p>
      ${renderAttachments("checkups", item)}
      <div class="card-actions">
        <button type="button" class="soft-button" data-action="mark-checkup-done" data-id="${esc(item.id)}">Hecho hoy</button>
        ${editButton("checkups", item.id)}${deleteButton("checkups", item.id)}
      </div>
    </article>`;
}

function renderTreatmentCard(item) {
  const today = dosesToday(item);
  const week = dosesThisWeek(item);
  const last = lastDose(item);
  const schedule = [item.frequency, item.times].filter(Boolean).join(" · ");
  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(item.medication)}</strong><p>${esc(item.dose || "Sin dosis")}${item.doctor ? ` · ${esc(item.doctor)}` : ""}</p></div>
        <span class="badge ${item.active ? "success" : "neutral"}">${item.active ? "activo" : "pausado"}</span>
      </div>
      <p>${formatDate(item.startDate)} ${item.endDate ? `→ ${formatDate(item.endDate)}` : ""}</p>
      ${schedule ? `<div class="record-meta"><span class="pill info">${esc(schedule)}</span></div>` : ""}
      <div class="record-meta">
        <span class="pill ${today > 0 ? "success" : "neutral"}">Hoy: ${today} toma${today === 1 ? "" : "s"}</span>
        <span class="pill neutral">7 días: ${week}</span>
        ${last ? `<span class="pill neutral">Última: ${formatDateTime(last)}</span>` : ""}
      </div>
      ${item.notes ? `<p>${esc(item.notes)}</p>` : ""}
      ${renderAttachments("treatments", item)}
      <div class="card-actions">
        ${item.active ? `<button type="button" class="soft-button" data-action="log-dose" data-id="${esc(item.id)}">Registrar toma</button>` : ""}
        <button type="button" class="ghost-button" data-action="toggle-treatment" data-id="${esc(item.id)}">${item.active ? "Pausar" : "Activar"}</button>
        ${editButton("treatments", item.id)}${deleteButton("treatments", item.id)}
      </div>
    </article>`;
}

// --- Historial ---

export function renderTimeline() {
  const data = scopedData();
  const timeline = buildTimeline(data).filter((item) => {
    const query = state.timelineSearch.toLowerCase().trim();
    const typeMatch = state.timelineType === "all" || item.type === state.timelineType;
    const text = `${item.title} ${item.description} ${item.meta} ${item.profileName}`.toLowerCase();
    return typeMatch && (!query || text.includes(query));
  });

  return `
    <section class="panel">
      <div class="section-header"><h2 class="section-title">Todo tu historial</h2></div>
      <div class="timeline-toolbar">
        <input id="timelineSearch" value="${esc(state.timelineSearch)}" placeholder="Buscar por síntoma, nota, especialidad...">
        <select id="timelineType">
          <option value="all" ${state.timelineType === "all" ? "selected" : ""}>Todos los tipos</option>
          ${["daily", "symptom", "body", "vitals", "appointment", "checkup", "treatment", "note"].map((type) => `<option value="${type}" ${state.timelineType === type ? "selected" : ""}>${typeLabel(type)}</option>`).join("")}
        </select>
        <button type="button" class="ghost-button" data-action="open-create">+ Registrar</button>
      </div>
      ${timeline.length ? `<div class="timeline-grid">${timeline.map(renderTimelineItem).join("")}</div>` : emptyState("Sin resultados", "No encontramos nada con esa búsqueda. Prueba con otras palabras.")}
    </section>`;
}

function renderTimelineItem(item) {
  return `
    <article class="timeline-item">
      <div class="record-header">
        <div><strong>${esc(item.title)}</strong><p>${formatDateTime(item.createdAt)}</p></div>
        <span class="badge ${item.tone || "neutral"}">${esc(typeLabel(item.type))}</span>
      </div>
      <p>${esc(item.description)}</p>
      <div class="record-meta">
        <span class="pill ${profileBadgeTone(item.profileId)}">${esc(item.profileName)}</span>
        ${item.meta ? `<span class="pill neutral">${esc(item.meta)}</span>` : ""}
      </div>
    </article>`;
}

// --- Mapa del cuerpo ---

const ZONE_TONE = { danger: "danger", warning: "warning", ok: "success", empty: "" };
const ZONE_WORD = {
  danger: "Necesita atención",
  warning: "Con novedad",
  ok: "Sin novedades",
  empty: "Sin registros"
};

// Regiones dibujadas de la silueta. El resto de secciones va en fichas aparte.
const SILHOUETTE = [
  { id: "cabeza", shape: `<ellipse cx="100" cy="40" rx="25" ry="29"/><rect x="92" y="66" width="16" height="14" rx="6"/>` },
  { id: "pecho", shape: `<rect x="62" y="78" width="76" height="66" rx="20"/>` },
  { id: "abdomen", shape: `<rect x="68" y="148" width="64" height="60" rx="18"/>` },
  { id: "brazos", shape: `<rect x="34" y="84" width="24" height="112" rx="12"/><rect x="142" y="84" width="24" height="112" rx="12"/>` },
  { id: "piernas", shape: `<rect x="70" y="212" width="27" height="150" rx="13"/><rect x="103" y="212" width="27" height="150" rx="13"/>` }
];

const SILHOUETTE_IDS = SILHOUETTE.map((region) => region.id);

export function renderBodyMap() {
  const data = scopedData();

  if (state.activeZone) return renderZoneDetail(data, state.activeZone);
  if (state.activeSection) return renderSectionDetail(data, state.activeSection);

  const sections = bodyMapSummary(data);
  const byId = Object.fromEntries(sections.map((section) => [section.id, section]));
  const needing = sections.filter((section) => section.status === "danger" || section.status === "warning");
  const extras = sections.filter((section) => !SILHOUETTE_IDS.includes(section.id));

  return `
    <section class="stack">
      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">Toca una zona</h2>
          <button type="button" class="soft-button" data-action="open-create" data-type="body">Registrar zona</button>
        </div>
        <p class="section-subtitle">
          ${needing.length
            ? `${needing.length} sección${needing.length > 1 ? "es" : ""} con algo por revisar: ${esc(needing.map((section) => section.label).join(", "))}.`
            : "Ninguna zona tiene novedades pendientes."}
        </p>

        <div class="body-map">
          <svg class="body-figure" viewBox="0 0 200 380" role="group" aria-label="Mapa del cuerpo">
            ${SILHOUETTE.map((region) => {
              const section = byId[region.id];
              return `<g class="body-region tone-${ZONE_TONE[section.status] || "empty"}" role="button" tabindex="0"
                          data-action="open-section" data-section="${region.id}"
                          aria-label="${esc(section.label)}: ${esc(ZONE_WORD[section.status])}">${region.shape}</g>`;
            }).join("")}
          </svg>
        </div>

        <div class="zone-chips">
          ${extras.map((section) => `
            <button type="button" class="zone-chip tone-${ZONE_TONE[section.status] || "empty"}" data-action="open-section" data-section="${section.id}">
              <span class="zone-dot"></span>${esc(section.label)}
            </button>
          `).join("")}
        </div>

        <div class="map-legend">
          <span><i class="tone-success"></i>Sin novedades</span>
          <span><i class="tone-warning"></i>Con novedad</span>
          <span><i class="tone-danger"></i>Necesita atención</span>
          <span><i class="tone-empty"></i>Sin registros</span>
        </div>
      </section>

      <section>
        <h2 class="section-title" style="margin-bottom:10px">Todas las secciones</h2>
        <div class="summary-list">
          ${sections.map((section) => `
            <button type="button" class="summary-row ${ZONE_TONE[section.status] ? `tone-${ZONE_TONE[section.status]}` : ""}" data-action="open-section" data-section="${section.id}">
              <span class="summary-icon ${ZONE_TONE[section.status] ? `tone-${ZONE_TONE[section.status]}` : ""}">${section.zones.length}</span>
              <span class="summary-text">
                <strong>${esc(section.label)}</strong>
                <small>${esc(ZONE_WORD[section.status])} · ${section.records} registro${section.records === 1 ? "" : "s"}</small>
              </span>
              <span class="summary-when">${section.attention ? `${section.attention} ⚑` : ""}</span>
              <span class="summary-chevron" aria-hidden="true">›</span>
            </button>
          `).join("")}
        </div>
      </section>
    </section>`;
}

function renderSectionDetail(data, sectionId) {
  const section = bodyMapSummary(data).find((item) => item.id === sectionId);
  if (!section) return renderBodyMap();

  return `
    <section class="stack">
      <button type="button" class="link-button" data-action="close-section">‹ Volver al mapa</button>

      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">${esc(section.label)}</h2>
          <span class="badge ${ZONE_TONE[section.status] || "neutral"}">${esc(ZONE_WORD[section.status])}</span>
        </div>
        <p class="section-subtitle">Toca una zona para ver todo lo que has registrado en ella.</p>
        <div class="summary-list">
          ${section.zones.map((zone) => `
            <button type="button" class="summary-row ${ZONE_TONE[zone.status] ? `tone-${ZONE_TONE[zone.status]}` : ""}" data-action="open-zone" data-zone="${esc(zone.zone)}">
              <span class="summary-icon ${ZONE_TONE[zone.status] ? `tone-${ZONE_TONE[zone.status]}` : ""}"><span class="zone-dot"></span></span>
              <span class="summary-text"><strong>${esc(zone.zone)}</strong><small>${esc(ZONE_WORD[zone.status])}</small></span>
              <span class="summary-when">${zone.count || ""}</span>
              <span class="summary-chevron" aria-hidden="true">›</span>
            </button>
          `).join("")}
        </div>
      </section>
    </section>`;
}

const ZONE_RECORD_LABEL = {
  symptom: "Síntoma",
  body: "Registro de zona",
  appointment: "Cita",
  checkup: "Control",
  treatment: "Tratamiento",
  note: "Nota"
};

function renderZoneDetail(data, zone) {
  const rows = recordsForZone(data, zone);
  const status = zoneStatus(data, zone);

  return `
    <section class="stack">
      <button type="button" class="link-button" data-action="close-section">‹ Volver</button>

      <section class="panel">
        <div class="section-header">
          <h2 class="section-title">${esc(zone)}</h2>
          <span class="badge ${ZONE_TONE[status] || "neutral"}">${esc(ZONE_WORD[status])}</span>
        </div>
        <div class="card-actions">
          <button type="button" class="soft-button" data-action="open-create" data-type="symptom">Registrar síntoma</button>
          <button type="button" class="primary-button" data-action="open-create" data-type="body">Registrar zona</button>
        </div>
      </section>

      <section class="panel">
        <div class="section-header"><h2 class="section-title">Todo lo de esta zona</h2></div>
        ${rows.length
          ? `<div class="timeline-grid">${rows.map(renderZoneRow).join("")}</div>`
          : emptyState("Sin registros en esta zona", "Cuando registres algo y elijas esta zona, aparecerá aquí.")}
      </section>
    </section>`;
}

function renderZoneRow({ kind, collection, item, date }) {
  const title = item.name || item.medication || item.specialty || item.title || item.symptom || item.bodyPart;
  const detail = item.notes || item.observations || item.content || item.reason || item.symptom || item.dose || "";
  return `
    <article class="timeline-item">
      <div class="record-header">
        <div><strong>${esc(title || "Registro")}</strong><p>${formatDate(date)}</p></div>
        <span class="badge neutral">${esc(ZONE_RECORD_LABEL[kind] || "Registro")}</span>
      </div>
      ${detail ? `<p>${esc(detail)}</p>` : ""}
      <div class="card-actions">${editButton(collection, item.id)}</div>
    </article>`;
}

// --- Presión arterial ---

export function renderVitalsPanel(data) {
  const list = sortedVitals(data);
  const latest = list[0];
  const level = latest ? bpLevel(latest.systolic, latest.diastolic) : null;
  const average = bpAverage(data);

  return `
    <section class="panel">
      <div class="section-header">
        <h2 class="section-title">Presión arterial</h2>
        <button type="button" class="primary-button" data-action="open-create" data-type="vitals">Nueva toma</button>
      </div>

      ${latest ? `
        <div class="bp-latest">
          <div class="bp-value">
            <strong>${esc(latest.systolic)}/${esc(latest.diastolic)}</strong>
            <small>mmHg · ${formatDate(latest.date)}${latest.time ? ` · ${esc(latest.time)}` : ""}</small>
          </div>
          ${level ? `<span class="badge ${level.tone}">${esc(level.label)}</span>` : ""}
        </div>
        ${average ? `<p class="section-subtitle">Promedio de los últimos 7 días: <strong>${average.systolic}/${average.diastolic}</strong> (${average.count} toma${average.count === 1 ? "" : "s"}).</p>` : ""}
        <p class="section-subtitle">Esta clasificación es solo una referencia para tu seguimiento; no reemplaza la valoración de tu médico.</p>
        <div class="timeline-grid">${list.slice(0, 8).map(renderVitalsCard).join("")}</div>
      ` : emptyState("Aún no has registrado tu presión", "Guarda una toma y aquí verás tu último valor, el promedio de la semana y su evolución.")}
    </section>`;
}

function renderVitalsCard(item) {
  const level = bpLevel(item.systolic, item.diastolic);
  return `
    <article class="record-card">
      <div class="record-header">
        <div>
          <strong>${esc(item.systolic)}/${esc(item.diastolic)} mmHg</strong>
          <p>${formatDate(item.date)}${item.time ? ` · ${esc(item.time)}` : ""} · ${esc(profileName(item.profileId))}</p>
        </div>
        ${level ? `<span class="badge ${level.tone}">${esc(level.label)}</span>` : ""}
      </div>
      <div class="record-meta">
        ${item.pulse ? `<span class="pill neutral">Pulso ${esc(item.pulse)}</span>` : ""}
        ${item.moment ? `<span class="pill neutral">${esc(item.moment)}</span>` : ""}
        ${item.arm ? `<span class="pill neutral">Brazo ${esc(item.arm.toLowerCase())}</span>` : ""}
      </div>
      ${item.notes ? `<p>${esc(item.notes)}</p>` : ""}
      <div class="card-actions">${editButton("vitals", item.id)}${deleteButton("vitals", item.id)}</div>
    </article>`;
}

// --- Notas ---

export function renderNotes() {
  const data = scopedData();
  const notes = sortDesc(data.notes, "createdAt");

  return `
    <section class="panel">
      <div class="section-header">
        <h2 class="section-title">Tus notas</h2>
        <button type="button" class="primary-button" data-action="open-create" data-type="note">Nueva nota</button>
      </div>
      ${notes.length
        ? `<div class="cards-grid">${notes.map(renderNoteCard).join("")}</div>`
        : emptyState("Aún no has escrito notas", "Guarda aquí observaciones, preguntas para el médico o recordatorios.")}
    </section>`;
}

function renderNoteCard(item) {
  return `
    <article class="record-card">
      <div class="record-header">
        <div><strong>${esc(item.title)}</strong><p>${formatDate(item.date || item.createdAt)}</p></div>
        <span class="badge neutral">${esc(item.category || "Nota")}</span>
      </div>
      <p>${esc(item.content || "")}</p>
      <div class="record-meta"><span class="pill ${profileBadgeTone(item.profileId)}">${esc(profileName(item.profileId))}</span></div>
      <div class="card-actions">${editButton("notes", item.id)}${deleteButton("notes", item.id)}</div>
    </article>`;
}

// --- Más ---

export function renderMore() {
  const person = state.user?.displayName || state.user?.email || "Tu cuenta";
  return `
    <section class="stack">
      <div class="more-list">
        ${MORE_ITEMS.map((item) => `
          <button type="button" class="more-item" data-view="${item.id}">
            <span class="more-icon">${esc(item.icon)}</span>
            <span>${esc(item.label)}<br><small class="section-subtitle">${esc(item.subtitle)}</small></span>
            <span class="more-chevron" aria-hidden="true">›</span>
          </button>
        `).join("")}
        <button type="button" class="more-item" data-action="open-account">
          <span class="more-icon">☺</span>
          <span>Perfil<br><small class="section-subtitle">${esc(person)}</small></span>
          <span class="more-chevron" aria-hidden="true">›</span>
        </button>
        <button type="button" class="more-item" data-action="open-menu">
          <span class="more-icon">⚙</span>
          <span>Ajustes<br><small class="section-subtitle">Personas, copias de seguridad</small></span>
          <span class="more-chevron" aria-hidden="true">›</span>
        </button>
        ${state.user ? `
          <button type="button" class="more-item danger" data-auth="logout">
            <span class="more-icon">⏻</span>
            <span>Cerrar sesión</span>
          </button>` : ""}
      </div>
    </section>`;
}

// --- Tus datos y copias de seguridad ---

export function renderDataTools() {
  const totalRecords = APP_CONFIG.collections
    .filter((name) => name !== "profiles")
    .reduce((sum, name) => sum + (state.data[name] || []).length, 0);

  return `
    <section class="stack">
      <div class="dashboard-grid">
        ${metric("Registros guardados", totalRecords, "en total")}
        ${metric("Personas", state.data.profiles.length, "con seguimiento")}
      </div>

      <section class="panel">
        <div class="section-header">
          <div>
            <h2 class="section-title">Copia de seguridad</h2>
            <p class="section-subtitle">Guarda una copia de toda tu información o restaura una copia anterior. No se borra nada.</p>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="ghost-button" data-action="open-import">Restaurar copia</button>
          <button type="button" class="primary-button" data-action="export-json">Guardar copia</button>
        </div>
        ${isDemoMode ? `<button type="button" class="danger-button" data-action="load-demo-reset">Reiniciar información de prueba</button>` : ""}
      </section>

      <section class="panel">
        <div class="section-header"><h2 class="section-title">Qué tienes registrado</h2></div>
        <div class="summary-list">
          ${DATA_GROUPS.map((group) => `
            <div class="summary-row">
              <span class="summary-icon">${esc(group.icon)}</span>
              <span class="summary-text"><strong>${esc(group.label)}</strong><small>${(state.data[group.collection] || []).length} registro(s)</small></span>
              <span class="summary-when"></span><span class="summary-chevron"></span>
            </div>
          `).join("")}
        </div>
      </section>
    </section>`;
}

const DATA_GROUPS = [
  { collection: "dailyLogs", label: "Registros diarios", icon: "☀" },
  { collection: "symptoms", label: "Síntomas", icon: "♡" },
  { collection: "bodyStatusEntries", label: "Registros del cuerpo", icon: "◎" },
  { collection: "appointments", label: "Citas", icon: "▤" },
  { collection: "checkups", label: "Controles", icon: "✓" },
  { collection: "treatments", label: "Tratamientos", icon: "✚" },
  { collection: "vitals", label: "Tomas de presión", icon: "♥" },
  { collection: "notes", label: "Notas", icon: "✎" }
];

export function renderView() {
  switch (state.activeView) {
    case "dashboard": return renderDashboard();
    case "tracking": return renderTracking();
    case "symptoms": return renderSymptoms();
    case "appointments": return renderAppointments();
    case "timeline": return renderTimeline();
    case "body": return renderBodyMap();
    case "notes": return renderNotes();
    case "more": return renderMore();
    case "data": return renderDataTools();
    default: return renderDashboard();
  }
}
