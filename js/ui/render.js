import {
  BODY_PARTS,
  STATUS_OPTIONS,
  FREQUENCY_OPTIONS,
  SPECIALTIES,
  CHECKUP_TYPES
} from "../data/body-parts.js";
import {
  summarizeProfile,
  computeAlerts,
  computeSemaphore,
  buildTimeline,
  scopeByProfile,
  getProfile,
  getProfileName,
  formatDate,
  formatDateTime,
  severityTone,
  appointmentTone,
  checkupTone,
  daysBetween,
  calculateNextDate,
  sortByDateDesc
} from "../services/health.service.js";
import { toastMarkup } from "../services/alerts.service.js";

const NAV_ITEMS = [
  { id: "dashboard", label: "Resumen" },
  { id: "body", label: "Cuerpo" },
  { id: "symptoms", label: "Síntomas" },
  { id: "appointments", label: "Citas" },
  { id: "checkups", label: "Controles" },
  { id: "treatments", label: "Tratamientos" },
  { id: "timeline", label: "Historial" },
  { id: "notes", label: "Notas" }
];

const SHELL_STATES = {
  BOOTING: "booting",
  AUTH: "auth",
  BLOCKED: "blocked",
  APP: "app"
};

const EMPTY_DATA = Object.freeze({
  profiles: [],
  bodyStatusEntries: [],
  symptoms: [],
  appointments: [],
  checkups: [],
  treatments: [],
  notes: []
});

const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const emptyState = (title, copy) => `
  <div class="empty-state">
    <h3>${title}</h3>
    <p>${copy}</p>
  </div>
`;

const profileOptions = (profiles, selectedProfileId) => `
  <option value="all" ${selectedProfileId === "all" ? "selected" : ""}>Vista compartida</option>
  ${profiles
    .map(
      (profile) =>
        `<option value="${profile.id}" ${selectedProfileId === profile.id ? "selected" : ""}>${profile.name}</option>`
    )
    .join("")}
`;

const navMarkup = (activeView) =>
  NAV_ITEMS.map(
    (item) => `
      <button
        type="button"
        class="nav-chip ${activeView === item.id ? "active" : ""}"
        data-view="${item.id}"
      >
        ${item.label}
      </button>
    `
  ).join("");

export function renderApp(rawState) {
  const state = normalizeState(rawState);
  const refs = getRefs();

  if (!refs.appShell) return;

  const shellState = resolveShellState(state);

  syncShellState(refs, shellState);
  syncSessionCard(refs, state, shellState);
  syncTopbarControls(refs, state, shellState);
  syncDevControls(refs);
  renderToast(state.toast);

  if (shellState !== SHELL_STATES.APP) {
    clearAppStage(refs);
    return;
  }

  if (!state.app.isDataReady) {
    renderLoadingAppStage(refs, state);
    return;
  }

  refs.profileSelector.innerHTML = profileOptions(
    state.data.profiles,
    state.selectedProfileId
  );

  refs.mainNav.innerHTML = navMarkup(state.activeView);
  refs.heroPanel.innerHTML = renderHero(state);
  refs.app.innerHTML = renderView(state);
}

function normalizeState(rawState = {}) {
  const state = {
    activeView: rawState.activeView || "dashboard",
    selectedProfileId: rawState.selectedProfileId || "all",
    timelineSearch: rawState.timelineSearch || "",
    timelineType: rawState.timelineType || "all",
    toast: rawState.toast || null,
    auth: {
      isReady: Boolean(rawState.auth?.isReady),
      isAuthenticated: Boolean(rawState.auth?.isAuthenticated),
      isAllowed: Boolean(rawState.auth?.isAllowed),
      user: rawState.auth?.user || null
    },
    app: {
      isBooting: Boolean(rawState.app?.isBooting),
      isDataLoading: Boolean(rawState.app?.isDataLoading),
      isDataReady: Boolean(rawState.app?.isDataReady),
      dataError: rawState.app?.dataError || null,
      lastHydratedAt: rawState.app?.lastHydratedAt || null
    },
    data: normalizeData(rawState.data)
  };

  if (
    state.selectedProfileId !== "all" &&
    !state.data.profiles.some((profile) => profile.id === state.selectedProfileId)
  ) {
    state.selectedProfileId = "all";
  }

  return state;
}

function normalizeData(data = {}) {
  return {
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    bodyStatusEntries: Array.isArray(data.bodyStatusEntries) ? data.bodyStatusEntries : [],
    symptoms: Array.isArray(data.symptoms) ? data.symptoms : [],
    appointments: Array.isArray(data.appointments) ? data.appointments : [],
    checkups: Array.isArray(data.checkups) ? data.checkups : [],
    treatments: Array.isArray(data.treatments) ? data.treatments : [],
    notes: Array.isArray(data.notes) ? data.notes : []
  };
}

function getRefs() {
  return {
    appShell: document.getElementById("appShell"),
    topbar: document.getElementById("topbar"),
    appStage: document.getElementById("appStage"),
    bootState: document.getElementById("bootState"),
    authState: document.getElementById("authState"),
    blockedState: document.getElementById("blockedState"),
    mainNav: document.getElementById("mainNav"),
    heroPanel: document.getElementById("heroPanel"),
    app: document.getElementById("app"),
    profileSelector: document.getElementById("profileSelector"),
    sessionUser: document.getElementById("sessionUser"),
    loginButton: document.getElementById("loginButton"),
    logoutButton: document.getElementById("logoutButton"),
    sessionCard: document.getElementById("sessionCard"),
    headerButtons: document.querySelector(".header-buttons"),
    topbarActions: document.querySelector(".topbar-actions")
  };
}

function resolveShellState(state) {
  if (state.app.isBooting || !state.auth.isReady) {
    return SHELL_STATES.BOOTING;
  }

  if (!state.auth.isAuthenticated) {
    return SHELL_STATES.AUTH;
  }

  if (!state.auth.isAllowed) {
    return SHELL_STATES.BLOCKED;
  }

  return SHELL_STATES.APP;
}

function syncShellState(refs, shellState) {
  refs.appShell.dataset.shellState = shellState;

  refs.bootState.hidden = shellState !== SHELL_STATES.BOOTING;
  refs.authState.hidden = shellState !== SHELL_STATES.AUTH;
  refs.blockedState.hidden = shellState !== SHELL_STATES.BLOCKED;
  refs.appStage.hidden = shellState !== SHELL_STATES.APP;
}

function syncSessionCard(refs, state, shellState) {
  if (!refs.sessionUser) return;

  const user = state.auth.user;
  const userLabel =
    user?.displayName?.trim() || user?.email?.trim() || "Sesión sin identificar";

  switch (shellState) {
    case SHELL_STATES.BOOTING:
      refs.sessionUser.textContent = "Verificando acceso...";
      break;
    case SHELL_STATES.AUTH:
      refs.sessionUser.textContent = "Sin sesión iniciada";
      break;
    case SHELL_STATES.BLOCKED:
      refs.sessionUser.textContent = userLabel;
      break;
    case SHELL_STATES.APP:
      refs.sessionUser.textContent = userLabel;
      break;
    default:
      refs.sessionUser.textContent = "Estado desconocido";
      break;
  }

  if (refs.loginButton) {
    refs.loginButton.hidden = state.auth.isAuthenticated;
  }

  if (refs.logoutButton) {
    refs.logoutButton.hidden = !state.auth.isAuthenticated;
  }
}

function syncTopbarControls(refs, state, shellState) {
  const appReady = shellState === SHELL_STATES.APP && state.app.isDataReady;

  if (refs.profileSelector) {
    refs.profileSelector.disabled = !appReady;
  }

  if (refs.topbarActions) {
    refs.topbarActions.hidden = shellState !== SHELL_STATES.APP;
  }

  if (refs.headerButtons) {
    refs.headerButtons.hidden = shellState !== SHELL_STATES.APP;
  }
}

function syncDevControls(refs) {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    new URLSearchParams(window.location.search).has("dev");

  document.querySelectorAll("[data-dev-only='true']").forEach((node) => {
    node.hidden = !isDev;
  });
}

function clearAppStage(refs) {
  if (refs.profileSelector) {
    refs.profileSelector.innerHTML = `<option value="all">Vista compartida</option>`;
  }

  if (refs.mainNav) refs.mainNav.innerHTML = "";
  if (refs.heroPanel) refs.heroPanel.innerHTML = "";
  if (refs.app) refs.app.innerHTML = "";
}

function renderLoadingAppStage(refs, state) {
  refs.profileSelector.innerHTML = `<option value="all">Vista compartida</option>`;
  refs.mainNav.innerHTML = "";
  refs.heroPanel.innerHTML = `
    <section class="hero-card">
      <div class="panel-header">
        <div>
          <h2 class="section-title">Cargando información</h2>
          <p class="section-subtitle">
            Estamos trayendo los perfiles y registros desde Firebase. Lo sé, otra cosa más esperando a que una nube responda.
          </p>
        </div>
        <span class="badge info">sincronizando</span>
      </div>
    </section>
  `;

  refs.app.innerHTML = state.app.dataError
    ? `
      <section class="module-layout">
        <section class="panel">
          ${emptyState(
            "No se pudo cargar la información",
            "La sesión sí pasó, pero los datos no cargaron bien. Revisen configuración, permisos o conexión."
          )}
        </section>
      </section>
    `
    : `
      <section class="module-layout">
        <section class="panel">
          ${emptyState(
            "Preparando la información",
            "Un momento mientras llega todo. La app ya está despierta, los datos todavía van en camino."
          )}
        </section>
      </section>
    `;
}

function renderToast(toast) {
  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();

  if (!toast) return;
  document.body.insertAdjacentHTML("beforeend", toastMarkup(toast));
}

function renderHero(state) {
  const alerts = computeAlerts(state.data, state.selectedProfileId);
  const semaphore = computeSemaphore(alerts);
  const sharedSummary = state.data.profiles.map((profile) => {
    const profileAlerts = computeAlerts(state.data, profile.id);
    const summary = summarizeProfile(state.data, profile.id);
    const profileSemaphore = computeSemaphore(profileAlerts);
    return { profile, summary, profileAlerts, profileSemaphore };
  });

  const profileLabel =
    state.selectedProfileId === "all"
      ? "Ambos perfiles"
      : getProfileName(state.data, state.selectedProfileId);

  const syncLabel = state.app.lastHydratedAt
    ? `Última carga: ${formatDateTime(state.app.lastHydratedAt)}`
    : "Sincronización reciente";

  return `
    <section class="hero-card">
      <div class="panel-header">
        <div>
          <h2 class="section-title">${profileLabel}</h2>
          <p class="section-subtitle">
            Seguimiento privado, ordenado y sincronizado para registrar síntomas, citas, controles y evolución sin perderse entre notas sueltas.
          </p>
        </div>
        <span class="semaphore ${semaphore.tone}">${semaphore.label}</span>
      </div>

      <div class="meta-item">
        <strong>Estado de carga</strong>
        <span>${syncLabel}</span>
      </div>

      <div class="hero-grid">
        ${sharedSummary
          .map(
            ({ profile, summary, profileAlerts, profileSemaphore }) => `
              <article class="profile-card" data-profile="${profile.id}">
                <div class="record-header">
                  <div>
                    <h3>${profile.name}</h3>
                    <p>${profile.shortGoal || "Seguimiento general"}</p>
                  </div>
                  <span class="semaphore ${profileSemaphore.tone}">${profileSemaphore.label}</span>
                </div>
                <div class="stats-grid">
                  <div class="metric-card">
                    <div class="metric-value">${summary.totalSymptoms}</div>
                    <div class="metric-label">síntomas activos</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-value">${summary.totalAppointments}</div>
                    <div class="metric-label">citas próximas</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-value">${summary.totalCheckups}</div>
                    <div class="metric-label">controles atrasados</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-value">${profileAlerts.length}</div>
                    <div class="metric-label">alertas activas</div>
                  </div>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderView(state) {
  switch (state.activeView) {
    case "dashboard":
      return renderDashboard(state);
    case "body":
      return renderBodyView(state);
    case "symptoms":
      return renderSymptomsView(state);
    case "appointments":
      return renderAppointmentsView(state);
    case "checkups":
      return renderCheckupsView(state);
    case "treatments":
      return renderTreatmentsView(state);
    case "timeline":
      return renderTimelineView(state);
    case "notes":
      return renderNotesView(state);
    default:
      return renderDashboard(state);
  }
}

function renderDashboard(state) {
  if (state.selectedProfileId === "all") {
    return renderSharedDashboard(state);
  }

  const profile = getProfile(state.data, state.selectedProfileId);
  if (!profile) {
    return renderSharedDashboard(state);
  }

  const summary = summarizeProfile(state.data, profile.id);
  const alerts = computeAlerts(state.data, profile.id);
  const semaphore = computeSemaphore(alerts);

  return `
    <section class="module-layout">
      <div class="summary-grid">
        <article class="summary-card">
          <div class="record-header">
            <div>
              <h3>Estado actual de ${profile.name}</h3>
              <p>Una lectura rápida para no tener que jugar a detectives con la memoria.</p>
            </div>
            <span class="semaphore ${semaphore.tone}">${semaphore.label}</span>
          </div>
          <div class="stats-grid">
            <div class="metric-card">
              <div class="metric-value">${summary.totalSymptoms}</div>
              <div class="metric-label">síntomas activos</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${summary.totalAppointments}</div>
              <div class="metric-label">citas próximas</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${summary.totalCheckups}</div>
              <div class="metric-label">controles atrasados</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${summary.totalTreatments}</div>
              <div class="metric-label">tratamientos activos</div>
            </div>
          </div>
        </article>

        <article class="summary-card">
          <h3>Próximo paso sugerido</h3>
          ${renderNextStep(summary, alerts)}
        </article>
      </div>

      <div class="shared-grid">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="section-title">Citas y pendientes</h3>
              <p class="section-subtitle">Lo inmediato, porque la salud no mejora por telepatía.</p>
            </div>
          </div>
          <div class="stacked-list">
            ${
              summary.nextAppointment
                ? renderAppointmentCompact(summary.nextAppointment)
                : emptyState(
                    "Sin citas próximas",
                    "Pueden agendar un nuevo control o registrar una cita pendiente."
                  )
            }
            ${
              summary.overdueCheckups.length
                ? summary.overdueCheckups.map(renderCheckupCompact).join("")
                : `<div class="meta-item"><strong>Controles</strong><span>Sin chequeos atrasados por ahora.</span></div>`
            }
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="section-title">Síntomas recientes</h3>
              <p class="section-subtitle">Lo que viene repitiéndose o molestando.</p>
            </div>
          </div>
          <div class="stacked-list">
            ${
              summary.activeSymptoms.length
                ? summary.activeSymptoms.slice(0, 4).map(renderSymptomCompact).join("")
                : emptyState(
                    "Sin síntomas activos",
                    "Eso está bastante decente. Igual pueden seguir registrando cómo se sienten."
                  )
            }
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="section-title">Seguimiento corporal</h3>
              <p class="section-subtitle">Últimos registros por parte del cuerpo.</p>
            </div>
          </div>
          <div class="stacked-list">
            ${
              summary.recentBodyEntries.length
                ? summary.recentBodyEntries.map(renderBodyCompact).join("")
                : emptyState(
                    "Sin registros corporales",
                    "Pueden empezar por sueño, energía, espalda o estado emocional."
                  )
            }
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="section-title">Notas rápidas</h3>
              <p class="section-subtitle">Recordatorios para próximas consultas o seguimiento.</p>
            </div>
          </div>
          <div class="stacked-list">
            ${
              summary.recentNotes.length
                ? summary.recentNotes.map(renderNoteCompact).join("")
                : emptyState(
                    "Sin notas recientes",
                    "Anoten dudas para futuras consultas antes de que la memoria haga sus trucos baratos."
                  )
            }
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3 class="section-title">Alertas activas</h3>
            <p class="section-subtitle">Resúmenes automáticos según intensidad, fechas y pendientes.</p>
          </div>
        </div>
        <div class="cards-grid">
          ${
            alerts.length
              ? alerts.map(renderAlertCard).join("")
              : emptyState(
                  "Todo relativamente tranquilo",
                  "No hay alertas fuertes ahora. Igual, registrar a tiempo siempre gana."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderSharedDashboard(state) {
  const alerts = computeAlerts(state.data, "all");
  const nextAppointments = sortByDateDesc(
    state.data.appointments.filter((item) =>
      ["pendiente", "agendada"].includes(item.status)
    ),
    ["date"]
  )
    .reverse()
    .slice(0, 6);
  const latestTimeline = buildTimeline(state.data, "all").slice(0, 8);

  return `
    <section class="module-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Resumen compartido</h2>
            <p class="section-subtitle">Para ver a Alek y Cata en una sola pantalla sin perder contexto.</p>
          </div>
          <span class="badge info">${alerts.length} alertas activas</span>
        </div>

        <div class="shared-grid">
          ${state.data.profiles
            .map((profile) => {
              const summary = summarizeProfile(state.data, profile.id);
              const profileAlerts = computeAlerts(state.data, profile.id);
              const semaphore = computeSemaphore(profileAlerts);

              return `
                <article class="profile-card" data-profile="${profile.id}">
                  <div class="record-header">
                    <div>
                      <h3>${profile.name}</h3>
                      <p>${profile.shortGoal || "Seguimiento general"}</p>
                    </div>
                    <span class="semaphore ${semaphore.tone}">${semaphore.label}</span>
                  </div>
                  <div class="meta-list">
                    <div class="meta-item">
                      <strong>Cita siguiente</strong>
                      <span>${
                        summary.nextAppointment
                          ? `${summary.nextAppointment.specialty} · ${formatDate(summary.nextAppointment.date)}`
                          : "Sin cita próxima"
                      }</span>
                    </div>
                    <div class="meta-item">
                      <strong>Síntomas activos</strong>
                      <span>${summary.totalSymptoms}</span>
                    </div>
                    <div class="meta-item">
                      <strong>Chequeos atrasados</strong>
                      <span>${summary.totalCheckups}</span>
                    </div>
                    <div class="meta-item">
                      <strong>Tratamientos activos</strong>
                      <span>${summary.totalTreatments}</span>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>

      <div class="dual-grid">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="section-title">Próximas citas de ambos</h3>
              <p class="section-subtitle">Todo lo que ya está encima o toca definir pronto.</p>
            </div>
          </div>
          <div class="stacked-list">
            ${
              nextAppointments.length
                ? nextAppointments.map((item) => renderAppointmentCompact(item, state.data)).join("")
                : emptyState(
                    "Sin citas próximas",
                    "Pueden empezar registrando controles pendientes o una nueva cita."
                  )
            }
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="section-title">Últimas novedades</h3>
              <p class="section-subtitle">Cronología reciente combinada de ambos perfiles.</p>
            </div>
          </div>
          <div class="stacked-list">
            ${
              latestTimeline.length
                ? latestTimeline.map((item) => renderTimelineCompact(item, state.data)).join("")
                : emptyState(
                    "Sin novedades",
                    "Apenas registren movimiento, esto empieza a contar la historia completa."
                  )
            }
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3 class="section-title">Alertas y focos</h3>
            <p class="section-subtitle">Cruce automático de señales que conviene revisar.</p>
          </div>
        </div>
        <div class="cards-grid">
          ${
            alerts.length
              ? alerts.map((alert) => renderAlertCard(alert, state.data)).join("")
              : emptyState(
                  "Todo estable",
                  "No hay banderas activas importantes en este momento."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderBodyView(state) {
  const records = sortByDateDesc(
    scopeByProfile(state.data.bodyStatusEntries, state.selectedProfileId)
  );
  const latestByPart = BODY_PARTS.map((bodyPart) => {
    const entry = records.find((item) => item.bodyPart === bodyPart);
    return { bodyPart, entry };
  });

  return `
    <section class="module-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Registrar parte del cuerpo</h2>
            <p class="section-subtitle">Simple, claro y útil para ver evolución real.</p>
          </div>
        </div>
        <form id="bodyForm">
          ${profileField(state)}
          <label class="field">
            <span>Parte del cuerpo</span>
            <select name="bodyPart" required>
              <option value="">Selecciona</option>
              ${BODY_PARTS.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Estado actual</span>
            <select name="status" required>
              <option value="">Selecciona</option>
              ${STATUS_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Molestia o síntoma</span>
            <input name="symptom" placeholder="Ej: tensión, sensibilidad, fatiga, dolor" required />
          </label>
          <label class="field">
            <span>Intensidad (1 a 10)</span>
            <input name="intensity" type="number" min="1" max="10" value="3" required />
          </label>
          <label class="field">
            <span>Frecuencia</span>
            <select name="frequency" required>
              <option value="">Selecciona</option>
              ${FREQUENCY_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Fecha de inicio</span>
            <input name="startDate" type="date" required />
          </label>
          <label class="field">
            <span>Observaciones</span>
            <textarea name="observations" placeholder="Qué ayuda, qué empeora, contexto, evolución..."></textarea>
          </label>
          <label class="inline-checkbox"><input type="checkbox" name="requiresAppointment" /> Requiere cita o seguimiento</label>
          <label class="inline-checkbox"><input type="checkbox" name="reviewed" /> Ya fue revisado</label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Guardar registro corporal</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Mapa práctico del cuerpo</h2>
            <p class="section-subtitle">Resumen por zona para detectar qué se repite y qué está tranquilo.</p>
          </div>
          <span class="badge info">${records.length} registros</span>
        </div>
        <div class="body-parts-grid">
          ${latestByPart.map(({ bodyPart, entry }) => renderBodyPartCard(bodyPart, entry)).join("")}
        </div>
      </section>
    </section>
  `;
}

function renderSymptomsView(state) {
  const records = sortByDateDesc(scopeByProfile(state.data.symptoms, state.selectedProfileId));

  return `
    <section class="module-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Registrar síntoma</h2>
            <p class="section-subtitle">Para ver patrones, duración y detonantes sin depender del recuerdo defectuoso humano.</p>
          </div>
        </div>
        <form id="symptomForm">
          ${profileField(state)}
          <label class="field">
            <span>Nombre del síntoma</span>
            <input name="name" placeholder="Ej: dolor de cabeza, ansiedad, ardor" required />
          </label>
          <label class="field">
            <span>Parte del cuerpo relacionada</span>
            <select name="bodyPart" required>
              <option value="">Selecciona</option>
              ${BODY_PARTS.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Intensidad (1 a 10)</span>
            <input name="intensity" type="number" min="1" max="10" value="4" required />
          </label>
          <label class="field">
            <span>Duración</span>
            <input name="duration" placeholder="Ej: 3 días, 2 semanas" required />
          </label>
          <label class="field">
            <span>Frecuencia</span>
            <select name="frequency" required>
              <option value="">Selecciona</option>
              ${FREQUENCY_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Fecha de inicio</span>
            <input name="startDate" type="date" required />
          </label>
          <label class="field">
            <span>Posibles detonantes</span>
            <input name="triggers" placeholder="Ej: estrés, postura, comida, poco sueño" />
          </label>
          <label class="field">
            <span>¿Mejora o empeora?</span>
            <input name="trend" placeholder="Ej: mejora al dormir, empeora con pantallas" />
          </label>
          <label class="field">
            <span>Notas</span>
            <textarea name="notes" placeholder="Contexto, sensación, dudas"></textarea>
          </label>
          <label class="field">
            <span>Estado</span>
            <select name="status" required>
              <option value="activo">Activo</option>
              <option value="en observación">En observación</option>
              <option value="resuelto">Resuelto</option>
            </select>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Guardar síntoma</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Síntomas registrados</h2>
            <p class="section-subtitle">Ordenados por recencia y con acciones rápidas.</p>
          </div>
          <span class="badge info">${records.length} registros</span>
        </div>
        <div class="cards-grid">
          ${
            records.length
              ? records.map((item) => renderSymptomCard(item, state.data)).join("")
              : emptyState(
                  "Aún no hay síntomas registrados",
                  "Pueden empezar anotando algo tan simple como sueño, energía o tensión muscular."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderAppointmentsView(state) {
  const records = sortByDateDesc(
    scopeByProfile(state.data.appointments, state.selectedProfileId),
    ["date", "createdAt"]
  );

  return `
    <section class="module-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Registrar cita médica</h2>
            <p class="section-subtitle">Con fecha, motivo y siguientes pasos para que no se pierda nada.</p>
          </div>
        </div>
        <form id="appointmentForm">
          ${profileField(state)}
          <label class="field">
            <span>Especialidad</span>
            <select name="specialty" required>
              <option value="">Selecciona</option>
              ${SPECIALTIES.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Doctor o entidad</span>
            <input name="doctor" placeholder="Ej: Dra. Gómez / EPS / laboratorio" />
          </label>
          <label class="field">
            <span>Fecha</span>
            <input name="date" type="date" required />
          </label>
          <label class="field">
            <span>Hora</span>
            <input name="time" type="time" required />
          </label>
          <label class="field">
            <span>Lugar</span>
            <input name="location" placeholder="Dirección, sede o ciudad" />
          </label>
          <label class="field">
            <span>Motivo</span>
            <input name="reason" placeholder="Qué se va a revisar" required />
          </label>
          <label class="field">
            <span>Estado</span>
            <select name="status" required>
              <option value="pendiente">Pendiente</option>
              <option value="agendada">Agendada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label class="field">
            <span>Resultado o conclusiones</span>
            <textarea name="result" placeholder="Lo que dijo el profesional o lo que quedó pendiente"></textarea>
          </label>
          <label class="field">
            <span>Próximos pasos</span>
            <textarea name="nextSteps" placeholder="Ej: pedir examen, reagendar, iniciar tratamiento"></textarea>
          </label>
          <label class="field">
            <span>Notas relacionadas</span>
            <textarea name="notes" placeholder="Archivos, cosas que llevar, observaciones"></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Guardar cita</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Agenda médica</h2>
            <p class="section-subtitle">Con estado, fecha y acciones rápidas para mantener el seguimiento.</p>
          </div>
          <span class="badge info">${records.length} citas</span>
        </div>
        <div class="cards-grid">
          ${
            records.length
              ? records.map((item) => renderAppointmentCard(item, state.data)).join("")
              : emptyState(
                  "Sin citas registradas",
                  "Registren la próxima, incluso si apenas está pendiente de sacar."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderCheckupsView(state) {
  const records = sortByDateDesc(
    scopeByProfile(state.data.checkups, state.selectedProfileId),
    ["idealNextDate", "createdAt"]
  );

  return `
    <section class="module-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Registrar control o chequeo</h2>
            <p class="section-subtitle">Para no olvidar lo periódico, que es justo lo que más se deja para después.</p>
          </div>
        </div>
        <form id="checkupForm">
          ${profileField(state)}
          <label class="field">
            <span>Nombre del control</span>
            <select name="name" required>
              <option value="">Selecciona</option>
              ${CHECKUP_TYPES.map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Frecuencia sugerida (meses)</span>
            <input name="frequencyMonths" type="number" min="1" value="6" required />
          </label>
          <label class="field">
            <span>Última vez realizado</span>
            <input name="lastDoneDate" type="date" required />
          </label>
          <label class="field">
            <span>Próxima fecha ideal</span>
            <input name="idealNextDate" type="date" />
          </label>
          <label class="field">
            <span>Estado</span>
            <select name="status" required>
              <option value="al día">Al día</option>
              <option value="por vencer">Por vencer</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </label>
          <label class="field">
            <span>Prioridad</span>
            <select name="priority" required>
              <option value="baja">Baja</option>
              <option value="media" selected>Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label class="field">
            <span>Observaciones</span>
            <textarea name="observations" placeholder="Qué toca revisar o por qué importa"></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Guardar control</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Controles y chequeos</h2>
            <p class="section-subtitle">Con prioridad, fecha ideal y avance.</p>
          </div>
          <span class="badge info">${records.length} controles</span>
        </div>
        <div class="cards-grid">
          ${
            records.length
              ? records.map((item) => renderCheckupCard(item, state.data)).join("")
              : emptyState(
                  "Sin controles registrados",
                  "Empiecen por odontología, medicina general y laboratorios básicos si les sirve."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderTreatmentsView(state) {
  const records = sortByDateDesc(scopeByProfile(state.data.treatments, state.selectedProfileId));

  return `
    <section class="module-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Registrar medicamento o tratamiento</h2>
            <p class="section-subtitle">Con motivo, duración e indicaciones para que el seguimiento no se diluya.</p>
          </div>
        </div>
        <form id="treatmentForm">
          ${profileField(state)}
          <label class="field">
            <span>Medicamento o tratamiento</span>
            <input name="medication" placeholder="Ej: ibuprofeno, suplemento, respiración guiada" required />
          </label>
          <label class="field">
            <span>Dosis</span>
            <input name="dosage" placeholder="Ej: 1 tableta, 10 minutos, 5 gotas" required />
          </label>
          <label class="field">
            <span>Horario</span>
            <input name="schedule" placeholder="Ej: mañana, noche, después de comer" required />
          </label>
          <label class="field">
            <span>Motivo</span>
            <input name="reason" placeholder="Para qué sirve o qué busca mejorar" required />
          </label>
          <label class="field">
            <span>Fecha de inicio</span>
            <input name="startDate" type="date" required />
          </label>
          <label class="field">
            <span>Fecha de fin</span>
            <input name="endDate" type="date" />
          </label>
          <label class="field">
            <span>Indicaciones</span>
            <textarea name="indications" placeholder="Cómo tomarlo o aplicarlo"></textarea>
          </label>
          <label class="field">
            <span>Efectos secundarios o notas</span>
            <textarea name="sideEffects" placeholder="Qué han notado o qué deben vigilar"></textarea>
          </label>
          <label class="inline-checkbox"><input type="checkbox" name="active" checked /> Sigue vigente</label>
          <label class="field">
            <span>Notas adicionales</span>
            <textarea name="notes" placeholder="Seguimiento, cambios, dudas"></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Guardar tratamiento</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Tratamientos activos e históricos</h2>
            <p class="section-subtitle">Conmutables y fáciles de revisar.</p>
          </div>
          <span class="badge info">${records.length} tratamientos</span>
        </div>
        <div class="cards-grid">
          ${
            records.length
              ? records.map((item) => renderTreatmentCard(item, state.data)).join("")
              : emptyState(
                  "Sin tratamientos registrados",
                  "También sirven rutinas, suplementos o prácticas recomendadas, no solo medicamentos."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderTimelineView(state) {
  const items = buildTimeline(state.data, state.selectedProfileId).filter((item) => {
    const matchesType = state.timelineType === "all" || item.type === state.timelineType;
    const haystack = `${item.title} ${item.description} ${item.meta}`.toLowerCase();
    const matchesSearch = haystack.includes(state.timelineSearch.trim().toLowerCase());
    return matchesType && matchesSearch;
  });

  return `
    <section class="module-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Historial de salud</h2>
            <p class="section-subtitle">Una línea de tiempo unificada con filtros útiles. Milagros de organización, una rareza preciosa.</p>
          </div>
        </div>

        <div class="filter-row">
          <label class="field">
            <span>Buscar</span>
            <input id="timelineSearch" value="${esc(state.timelineSearch)}" placeholder="buscar síntoma, cita, nota..." />
          </label>
          <label class="field">
            <span>Tipo</span>
            <select id="timelineType">
              <option value="all" ${state.timelineType === "all" ? "selected" : ""}>Todo</option>
              <option value="body" ${state.timelineType === "body" ? "selected" : ""}>Cuerpo</option>
              <option value="symptom" ${state.timelineType === "symptom" ? "selected" : ""}>Síntomas</option>
              <option value="appointment" ${state.timelineType === "appointment" ? "selected" : ""}>Citas</option>
              <option value="checkup" ${state.timelineType === "checkup" ? "selected" : ""}>Controles</option>
              <option value="treatment" ${state.timelineType === "treatment" ? "selected" : ""}>Tratamientos</option>
              <option value="note" ${state.timelineType === "note" ? "selected" : ""}>Notas</option>
            </select>
          </label>
        </div>

        <div class="timeline-grid">
          ${
            items.length
              ? items.map((item) => renderTimelineItem(item, state.data)).join("")
              : emptyState(
                  "No hay coincidencias",
                  "Cambien el filtro o el texto de búsqueda para ver más registros."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderNotesView(state) {
  const notes = sortByDateDesc(scopeByProfile(state.data.notes, state.selectedProfileId));

  return `
    <section class="module-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Nota libre</h2>
            <p class="section-subtitle">Para emociones, preguntas para el médico o recordatorios útiles.</p>
          </div>
        </div>
        <form id="noteForm">
          ${profileField(state)}
          <label class="field">
            <span>Título</span>
            <input name="title" placeholder="Ej: preguntar por sueño, recordar radiografía" required />
          </label>
          <label class="field">
            <span>Etiqueta emocional o práctica</span>
            <input name="moodTag" placeholder="Ej: calma, seguimiento, dudas, práctico" />
          </label>
          <label class="field">
            <span>Contenido</span>
            <textarea name="content" placeholder="Escriban lo que quieran recordar o contar" required></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Guardar nota</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Notas guardadas</h2>
            <p class="section-subtitle">Asociadas al perfil seleccionado o compartidas por vista.</p>
          </div>
          <span class="badge info">${notes.length} notas</span>
        </div>
        <div class="notes-grid">
          ${
            notes.length
              ? notes.map((item) => renderNoteCard(item, state.data)).join("")
              : emptyState(
                  "Sin notas aún",
                  "Anoten inquietudes antes de una cita o cambios que quieran observar mejor."
                )
          }
        </div>
      </section>
    </section>
  `;
}

function renderNextStep(summary, alerts) {
  if (summary.nextAppointment) {
    return `
      <div class="meta-item">
        <strong>Próxima cita</strong>
        <span>${summary.nextAppointment.specialty} el ${formatDate(summary.nextAppointment.date)} a las ${summary.nextAppointment.time}</span>
      </div>
      <p class="small-copy">Motivo: ${summary.nextAppointment.reason}. ${summary.nextAppointment.nextSteps || ""}</p>
    `;
  }

  if (summary.overdueCheckups.length) {
    const check = summary.overdueCheckups[0];
    return `
      <div class="meta-item">
        <strong>Chequeo atrasado</strong>
        <span>${check.name} estaba ideal para ${formatDate(check.idealNextDate)}</span>
      </div>
      <p class="small-copy">Prioridad ${check.priority}. Conviene definir si toca agendarlo esta semana.</p>
    `;
  }

  if (alerts.length) {
    return `<p class="small-copy">La alerta principal es: <strong>${alerts[0].title}</strong>. ${alerts[0].description}</p>`;
  }

  return `<p class="small-copy">No hay una urgencia evidente. Pueden usar el registro diario para sueño, energía, cuerpo y próximos controles.</p>`;
}

function renderBodyPartCard(bodyPart, entry) {
  if (!entry) {
    return `
      <article class="body-part-card">
        <div>
          <strong>${bodyPart}</strong>
          <p class="small-copy">Sin registros recientes.</p>
        </div>
        <span class="badge info">por registrar</span>
      </article>
    `;
  }

  const tone = severityTone(entry.intensity);
  return `
    <article class="body-part-card">
      <div class="record-header">
        <div>
          <strong>${bodyPart}</strong>
          <p class="small-copy">${entry.symptom}</p>
        </div>
        <span class="badge ${tone}">${entry.intensity}/10</span>
      </div>
      <div class="meta-list">
        <div class="meta-item">
          <strong>Estado</strong>
          <span>${entry.status}</span>
        </div>
        <div class="meta-item">
          <strong>Inicio</strong>
          <span>${formatDate(entry.startDate)}</span>
        </div>
      </div>
      <div class="record-actions">
        <button type="button" class="inline-button" data-action="toggle-reviewed" data-collection="bodyStatusEntries" data-id="${entry.id}">
          ${entry.reviewed ? "Marcar sin revisar" : "Marcar revisado"}
        </button>
        <button type="button" class="inline-button" data-action="delete-item" data-collection="bodyStatusEntries" data-id="${entry.id}">
          Eliminar
        </button>
      </div>
    </article>
  `;
}

function renderSymptomCard(item, data) {
  const tone = severityTone(item.intensity);
  return `
    <article class="record-card">
      <header>
        <div>
          <h3>${item.name}</h3>
          <p>${getProfileName(data, item.profileId)} · ${item.bodyPart}</p>
        </div>
        <span class="badge ${tone}">${item.intensity}/10</span>
      </header>
      <div class="meta-list">
        <div class="meta-item"><strong>Estado</strong><span>${item.status}</span></div>
        <div class="meta-item"><strong>Inicio</strong><span>${formatDate(item.startDate)}</span></div>
        <div class="meta-item"><strong>Frecuencia</strong><span>${item.frequency}</span></div>
        <div class="meta-item"><strong>Duración</strong><span>${item.duration}</span></div>
      </div>
      <p>${item.notes || item.trend || "Sin notas adicionales."}</p>
      <div class="record-actions">
        ${
          item.status !== "resuelto"
            ? `<button type="button" class="inline-button" data-action="resolve-symptom" data-id="${item.id}">Marcar resuelto</button>`
            : ""
        }
        <button type="button" class="inline-button" data-action="delete-item" data-collection="symptoms" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderAppointmentCard(item, data) {
  const tone = appointmentTone(item.status, item.date);
  const diff = daysBetween(item.date);
  const relative =
    diff === null ? "" : diff < 0 ? `vencida hace ${Math.abs(diff)} días` : `faltan ${diff} días`;

  return `
    <article class="record-card">
      <header>
        <div>
          <h3>${item.specialty}</h3>
          <p>${getProfileName(data, item.profileId)} · ${item.reason}</p>
        </div>
        <span class="badge ${tone}">${item.status}</span>
      </header>
      <div class="meta-list">
        <div class="meta-item"><strong>Fecha</strong><span>${formatDate(item.date)} ${item.time || ""}</span></div>
        <div class="meta-item"><strong>Doctor / entidad</strong><span>${item.doctor || item.entity || "Sin dato"}</span></div>
        <div class="meta-item"><strong>Lugar</strong><span>${item.location || "Sin lugar"}</span></div>
        <div class="meta-item"><strong>Tiempo</strong><span>${relative || "Sin cálculo"}</span></div>
      </div>
      <p>${item.nextSteps || item.result || item.notes || "Sin observaciones."}</p>
      <div class="record-actions">
        ${
          item.status !== "realizada"
            ? `<button type="button" class="inline-button" data-action="complete-appointment" data-id="${item.id}">Marcar realizada</button>`
            : ""
        }
        ${
          item.status !== "cancelada"
            ? `<button type="button" class="inline-button" data-action="cancel-appointment" data-id="${item.id}">Cancelar</button>`
            : ""
        }
        <button type="button" class="inline-button" data-action="delete-item" data-collection="appointments" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderCheckupCard(item, data) {
  const tone = checkupTone(item);
  return `
    <article class="record-card">
      <header>
        <div>
          <h3>${item.name}</h3>
          <p>${getProfileName(data, item.profileId)}</p>
        </div>
        <span class="badge ${tone}">${item.status}</span>
      </header>
      <div class="meta-list">
        <div class="meta-item"><strong>Frecuencia</strong><span>${item.frequencyMonths} meses</span></div>
        <div class="meta-item"><strong>Último control</strong><span>${formatDate(item.lastDoneDate)}</span></div>
        <div class="meta-item"><strong>Próxima fecha ideal</strong><span>${formatDate(item.idealNextDate)}</span></div>
        <div class="meta-item"><strong>Prioridad</strong><span>${item.priority}</span></div>
      </div>
      <p>${item.observations || "Sin observaciones."}</p>
      <div class="record-actions">
        <button type="button" class="inline-button" data-action="mark-checkup-done" data-id="${item.id}">Marcar realizado hoy</button>
        <button type="button" class="inline-button" data-action="delete-item" data-collection="checkups" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderTreatmentCard(item, data) {
  const tone = item.active ? "success" : "warning";
  return `
    <article class="record-card">
      <header>
        <div>
          <h3>${item.medication}</h3>
          <p>${getProfileName(data, item.profileId)} · ${item.reason}</p>
        </div>
        <span class="badge ${tone}">${item.active ? "vigente" : "cerrado"}</span>
      </header>
      <div class="meta-list">
        <div class="meta-item"><strong>Dosis</strong><span>${item.dosage}</span></div>
        <div class="meta-item"><strong>Horario</strong><span>${item.schedule}</span></div>
        <div class="meta-item"><strong>Inicio</strong><span>${formatDate(item.startDate)}</span></div>
        <div class="meta-item"><strong>Fin</strong><span>${formatDate(item.endDate)}</span></div>
      </div>
      <p>${item.indications || item.notes || "Sin indicaciones guardadas."}</p>
      <div class="record-actions">
        <button type="button" class="inline-button" data-action="toggle-treatment" data-id="${item.id}">
          ${item.active ? "Cerrar tratamiento" : "Reactivar"}
        </button>
        <button type="button" class="inline-button" data-action="delete-item" data-collection="treatments" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderNoteCard(item, data) {
  return `
    <article class="record-card">
      <header>
        <div>
          <h3>${item.title}</h3>
          <p>${getProfileName(data, item.profileId)} · ${item.moodTag || "nota"}</p>
        </div>
        <span class="badge info">${formatDateTime(item.createdAt)}</span>
      </header>
      <p>${item.content}</p>
      <div class="record-actions">
        <button type="button" class="inline-button" data-action="delete-item" data-collection="notes" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderTimelineItem(item, data) {
  const tone =
    item.type === "symptom" ? "warning" : item.type === "appointment" ? "info" : "success";
  return `
    <article class="timeline-item" data-type="${item.type}">
      <header>
        <div>
          <h3>${item.title}</h3>
          <p>${getProfileName(data, item.profileId)} · ${item.meta}</p>
        </div>
        <span class="badge ${tone}">${formatDateTime(item.createdAt)}</span>
      </header>
      <p>${item.description}</p>
    </article>
  `;
}

function renderAlertCard(alert, data) {
  return `
    <article class="alert-card" data-level="${alert.level}">
      <div class="record-header">
        <div>
          <h3>${alert.title}</h3>
          <p>${data ? getProfileName(data, alert.profileId) : ""}</p>
        </div>
        <span class="badge ${alert.level}">${alert.level}</span>
      </div>
      <p>${alert.description}</p>
    </article>
  `;
}

function renderAppointmentCompact(item, data) {
  return `
    <div class="meta-item">
      <strong>${item.specialty}</strong>
      <span>${data ? `${getProfileName(data, item.profileId)} · ` : ""}${formatDate(item.date)} ${item.time || ""}</span>
      <div class="small-copy">${item.reason}</div>
    </div>
  `;
}

function renderCheckupCompact(item) {
  return `
    <div class="meta-item">
      <strong>${item.name}</strong>
      <span>Próxima fecha ideal: ${formatDate(item.idealNextDate)}</span>
      <div class="small-copy">Prioridad ${item.priority}</div>
    </div>
  `;
}

function renderSymptomCompact(item) {
  return `
    <div class="meta-item">
      <strong>${item.name}</strong>
      <span>${item.bodyPart} · ${item.intensity}/10 · ${item.status}</span>
      <div class="small-copy">${item.trend || item.notes || "Sin detalle adicional."}</div>
    </div>
  `;
}

function renderBodyCompact(item) {
  return `
    <div class="meta-item">
      <strong>${item.bodyPart}</strong>
      <span>${item.status} · ${item.intensity}/10</span>
      <div class="small-copy">${item.symptom}</div>
    </div>
  `;
}

function renderNoteCompact(item) {
  return `
    <div class="meta-item">
      <strong>${item.title}</strong>
      <span>${item.moodTag || "nota"}</span>
      <div class="small-copy">${item.content}</div>
    </div>
  `;
}

function renderTimelineCompact(item, data) {
  return `
    <div class="meta-item">
      <strong>${item.title}</strong>
      <span>${getProfileName(data, item.profileId)} · ${formatDateTime(item.createdAt)}</span>
      <div class="small-copy">${item.description}</div>
    </div>
  `;
}

function profileField(state) {
  const options = state.data.profiles.map(
    (profile) =>
      `<option value="${profile.id}" ${
        state.selectedProfileId === profile.id ? "selected" : ""
      }>${profile.name}</option>`
  );

  return `
    <label class="field">
      <span>Perfil</span>
      <select name="profileId" required>
        <option value="">Selecciona</option>
        ${options.join("")}
      </select>
    </label>
  `;
}

export function getDerivedDefaultsForCheckup(form) {
  const lastDoneDate = form.querySelector('[name="lastDoneDate"]')?.value;
  const frequencyMonths = form.querySelector('[name="frequencyMonths"]')?.value;
  const idealInput = form.querySelector('[name="idealNextDate"]');

  if (lastDoneDate && frequencyMonths && idealInput && !idealInput.value) {
    idealInput.value = calculateNextDate(lastDoneDate, frequencyMonths);
  }
}