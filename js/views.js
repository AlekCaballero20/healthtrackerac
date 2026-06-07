// Funciones de presentación: reciben el estado/datos y devuelven HTML.
// No mutan estado ni hablan con Firebase (eso vive en app.js / firebase.js).

import { APP_CONFIG } from "./config.js";
import { isDemoMode } from "./firebase.js";
import {
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
  dueCheckups,
  lastDose,
  metricSeries,
  summarize,
  upcomingAppointments
} from "./domain.js";
import { typeLabel } from "./records.js";

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
  return `<section class="empty-state"><h3>Cargando</h3><p>Estamos preparando sesión y datos. Hasta las apps tienen que respirar antes de funcionar.</p></section>`;
}

export function renderAuthState() {
  return `
    <section class="empty-state">
      <h3>Acceso privado</h3>
      <p>Ingresa con una cuenta autorizada para cargar los datos de Alek y Cata.</p>
      <div class="form-actions"><button type="button" class="primary-button" data-auth="login">Ingresar con Google</button></div>
    </section>`;
}

export function renderBlockedState() {
  return `
    <section class="empty-state">
      <h3>Cuenta no autorizada</h3>
      <p>Cierra sesión e ingresa con un correo permitido.</p>
      <div class="form-actions"><button type="button" class="ghost-button" data-auth="logout">Cerrar sesión</button></div>
    </section>`;
}

export function renderErrorState(message) {
  return `
    <section class="empty-state">
      <h3>No se pudo cargar la información</h3>
      <p>${esc(message)}</p>
      <div class="form-actions"><button type="button" class="primary-button" data-action="reload">Recargar</button></div>
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
          <p class="eyebrow">Registro rápido</p>
          <h3>¿Cómo va el día?</h3>
          <p class="section-subtitle">Un check-in de 30 segundos para que el seguimiento no dependa de “creo que me sentía raro hace como tres martes”.</p>
        </div>
        <button type="button" class="soft-button" data-action="open-create" data-type="daily">Abrir completo</button>
      </div>
      <form id="quickCheckinForm" class="quick-grid">
        <label class="field"><span>Perfil</span><select name="profileId" required>${profileOptions}</select></label>
        <label class="field"><span>Fecha</span><input type="date" name="date" value="${today}" required></label>
        <label class="field">
          <span>Energía</span>
          <div class="range-row"><input type="range" name="energy" min="1" max="10" value="6"><strong class="range-value">6</strong></div>
        </label>
        <label class="field">
          <span>Dolor</span>
          <div class="range-row"><input type="range" name="painLevel" min="0" max="10" value="0"><strong class="range-value">0</strong></div>
        </label>
        <label class="field"><span>Sueño</span><input type="number" name="sleepHours" min="0" max="24" step="0.5" value="7"></label>
        <label class="field">
          <span>Ánimo</span>
          <select name="mood">
            <option value="estable">Estable</option>
            <option value="feliz">Feliz</option>
            <option value="sensible">Sensible</option>
            <option value="cansado">Cansado</option>
            <option value="ansioso">Ansioso</option>
            <option value="irritable">Irritable</option>
          </select>
        </label>
        <label class="field full"><span>Nota corta</span><input name="note" placeholder="Algo importante del día, gatillos, avances o rarezas corporales"></label>
        <div class="field full form-actions"><button type="submit" class="primary-button">Guardar check-in</button></div>
      </form>
    </section>`;
}

// --- Dashboard ---

export function renderDashboard() {
  const data = scopedData();
  const alerts = computeAlerts(data);
  const summary = summarize(data);
  const timeline = buildTimeline(data).slice(0, 6);

  return `
    <section class="stack">
      <div class="dashboard-grid">
        ${metric("Síntomas activos", summary.activeSymptoms, "Pendientes de revisar")}
        ${metric("Citas próximas", summary.upcomingAppointments, "Agenda abierta")}
        ${metric("Controles vencidos", summary.dueCheckups, "Chequeos para programar")}
        ${metric("Tratamientos activos", summary.activeTreatments, "Medicamentos en curso")}
      </div>

      <section class="panel">
        <div class="section-header">
          <div><p class="eyebrow">Prioridades</p><h3>Lo que conviene mirar primero</h3></div>
          <span class="badge ${alerts.some((a) => a.level === "danger") ? "danger" : alerts.length ? "warning" : "success"}">${alerts.length ? `${alerts.length} alerta${alerts.length > 1 ? "s" : ""}` : "estable"}</span>
        </div>
        ${alerts.length ? `<div class="cards-grid">${alerts.slice(0, 6).map(renderAlert).join("")}</div>` : emptyState("Sin alertas críticas", "No hay síntomas altos, citas vencidas ni controles urgentes en esta vista.")}
      </section>

      <section class="panel">
        <div class="section-header">
          <div><p class="eyebrow">Últimos movimientos</p><h3>Historial reciente</h3></div>
          <button type="button" class="ghost-button" data-view="timeline">Ver historial</button>
        </div>
        ${timeline.length ? `<div class="timeline-grid">${timeline.map(renderTimelineItem).join("")}</div>` : emptyState("Todavía no hay historial", "Empieza con un check-in o registra un síntoma para que esto deje de parecer apartamento recién entregado.")}
      </section>
    </section>`;
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
          <div><p class="eyebrow">Tendencias</p><h3>Evolución de los check-ins</h3></div>
          <button type="button" class="primary-button" data-action="open-create" data-type="daily">Nuevo check-in</button>
        </div>
        <div class="chart-tabs">
          ${CHART_METRICS.map((m) => `<button type="button" class="chip ${m.id === activeMetric.id ? "active" : ""}" data-action="set-chart-metric" data-metric="${m.id}">${esc(m.label)}</button>`).join("")}
        </div>
        ${series.length ? renderMetricChart(series, activeMetric) : emptyState("Sin check-ins", "Guarda algunos registros diarios y aquí aparecerá la evolución.")}
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

      <section class="panel">
        <div class="section-header"><div><p class="eyebrow">Registros</p><h3>Check-ins recientes</h3></div></div>
        ${logs.length ? `<div class="timeline-grid">${logs.slice(0, 12).map(renderDailyLogCard).join("")}</div>` : emptyState("Nada registrado", "El botón de arriba está ahí, heroico y subutilizado.")}
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
          <div><p class="eyebrow">Síntomas</p><h3>Molestias y evolución</h3></div>
          <div class="card-actions">
            <button type="button" class="ghost-button" data-action="open-create" data-type="body">Registrar cuerpo</button>
            <button type="button" class="primary-button" data-action="open-create" data-type="symptom">Nuevo síntoma</button>
          </div>
        </div>
        ${symptoms.length ? `<div class="cards-grid">${symptoms.map(renderSymptomCard).join("")}</div>` : emptyState("Sin síntomas registrados", "Idealmente porque están bien, no porque nadie quiso llenar el formulario. Igual aquí queda listo.")}
      </section>

      <section class="panel">
        <div class="section-header"><div><p class="eyebrow">Mapa corporal</p><h3>Partes del cuerpo registradas</h3></div></div>
        ${body.length ? `<div class="cards-grid">${body.map(renderBodyCard).join("")}</div>` : emptyState("Sin registros corporales", "Puedes registrar una parte del cuerpo específica cuando algo necesite seguimiento fino.")}
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
          <div><p class="eyebrow">Agenda</p><h3>Citas médicas</h3></div>
          <button type="button" class="primary-button" data-action="open-create" data-type="appointment">Nueva cita</button>
        </div>
        ${appointments.length ? `<div class="cards-grid">${appointments.map(renderAppointmentCard).join("")}</div>` : emptyState("Sin citas", "Cuando haya una cita, ponla aquí y deja de confiar en chats perdidos de WhatsApp.")}
      </section>

      <section class="panel">
        <div class="section-header">
          <div><p class="eyebrow">Controles</p><h3>Chequeos periódicos</h3></div>
          <button type="button" class="ghost-button" data-action="open-create" data-type="checkup">Nuevo control</button>
        </div>
        ${checkups.length ? `<div class="cards-grid">${checkups.map(renderCheckupCard).join("")}</div>` : emptyState("Sin controles", "Agrega odontología, exámenes, visión o cualquier chequeo recurrente.")}
      </section>

      <section class="panel">
        <div class="section-header">
          <div><p class="eyebrow">Tratamientos</p><h3>Medicamentos e indicaciones</h3></div>
          <button type="button" class="ghost-button" data-action="open-create" data-type="treatment">Nuevo tratamiento</button>
        </div>
        ${treatments.length ? `<div class="cards-grid">${treatments.map(renderTreatmentCard).join("")}</div>` : emptyState("Sin tratamientos", "Aquí puedes guardar medicamentos, terapias o indicaciones temporales.")}
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
      <div class="section-header"><div><p class="eyebrow">Historial unificado</p><h3>Buscar en todo</h3></div></div>
      <div class="timeline-toolbar">
        <input id="timelineSearch" value="${esc(state.timelineSearch)}" placeholder="Buscar por síntoma, nota, especialidad...">
        <select id="timelineType">
          <option value="all" ${state.timelineType === "all" ? "selected" : ""}>Todos los tipos</option>
          ${["daily", "symptom", "body", "appointment", "checkup", "treatment", "note"].map((type) => `<option value="${type}" ${state.timelineType === type ? "selected" : ""}>${typeLabel(type)}</option>`).join("")}
        </select>
        <button type="button" class="ghost-button" data-action="open-create">+ Registrar</button>
      </div>
      ${timeline.length ? `<div class="timeline-grid">${timeline.map(renderTimelineItem).join("")}</div>` : emptyState("Sin resultados", "No encontré nada con esos filtros. Qué raro, un buscador con límites.")}
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

// --- Datos y backup ---

export function renderDataTools() {
  const totalRecords = APP_CONFIG.collections.reduce((sum, name) => sum + (state.data[name] || []).length, 0);
  return `
    <section class="stack">
      <div class="dashboard-grid">
        ${metric("Colecciones", APP_CONFIG.collections.length, "Firestore")}
        ${metric("Registros", totalRecords, "total")}
        ${metric("Perfiles", state.data.profiles.length, "activos")}
        ${metric("Modo", isDemoMode ? "Demo" : "Firebase", "almacenamiento")}
      </div>
      <section class="panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">Backup</p>
            <h3>Exportar e importar</h3>
            <p class="section-subtitle">Exporta un JSON completo o importa un backup anterior. Cómodo, como debería haber sido desde el principio.</p>
          </div>
          <div class="card-actions">
            <button type="button" class="ghost-button" data-action="open-import">Importar</button>
            <button type="button" class="primary-button" data-action="export-json">Exportar JSON</button>
          </div>
        </div>
        ${isDemoMode ? `<button type="button" class="danger-button" data-action="load-demo-reset">Restaurar demo local</button>` : ""}
      </section>
      <section class="panel">
        <div class="section-header"><div><p class="eyebrow">Estructura</p><h3>Colecciones usadas</h3></div></div>
        <div class="cards-grid">
          ${APP_CONFIG.collections.map((name) => `<article class="record-card"><strong>${name}</strong><p>${(state.data[name] || []).length} registros</p></article>`).join("")}
        </div>
      </section>
    </section>`;
}

export function renderView() {
  switch (state.activeView) {
    case "dashboard": return renderDashboard();
    case "tracking": return renderTracking();
    case "symptoms": return renderSymptoms();
    case "appointments": return renderAppointments();
    case "timeline": return renderTimeline();
    case "data": return renderDataTools();
    default: return renderDashboard();
  }
}
