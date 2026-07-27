// Controlador de la app: arranque, eventos, acciones y orquestación del render.
// La lógica vive en módulos: utils, state, domain, records, views, firebase.

import { APP_CONFIG } from "./config.js";
import {
  createRecord,
  deleteAttachment,
  importRecords,
  isAllowedEmail,
  isDemoMode,
  loadAllData,
  loginWithGoogle,
  logoutCurrentUser,
  observeSession,
  removeRecord,
  updateRecord,
  uploadAttachment
} from "./firebase.js";
import {
  $,
  $$,
  calculateNextDate,
  getFormData,
  setToastZone,
  toast,
  todayISO
} from "./utils.js";
import { emptyData, normalizeData, scopedData, state } from "./state.js";
import {
  activeSymptoms,
  computeAlerts,
  dueCheckups,
  upcomingAppointments
} from "./domain.js";
import {
  COLLECTION_BY_TYPE,
  NAV_ITEMS,
  RECORD_TYPES,
  buildRecord,
  preferredTypeForView,
  renderRecordForm,
  typeForCollection,
  viewMeta
} from "./records.js";
import {
  renderAlertsList,
  renderAuthState,
  renderBlockedState,
  renderErrorState,
  renderLoading,
  renderQuickCheckin,
  renderView
} from "./views.js";

const refs = {
  app: $("#app"),
  quickCheckin: $("#quickCheckin"),
  nav: $("#mainNav"),
  statusBanner: $("#statusBanner"),
  profileSelector: $("#profileSelector"),
  viewTitle: $("#viewTitle"),
  viewSubtitle: $("#viewSubtitle"),
  sessionLabel: $("#sessionLabel"),
  sessionHint: $("#sessionHint"),
  avatarInitials: $("#avatarInitials"),
  accountInitials: $("#accountInitials"),
  alertDot: $("#alertDot"),
  menuSheet: $("#menuSheet"),
  alertsSheet: $("#alertsSheet"),
  alertsMount: $("#alertsMount"),
  accountSheet: $("#accountSheet"),
  recordDialog: $("#recordDialog"),
  recordTypeGrid: $("#recordTypeGrid"),
  recordFormMount: $("#recordFormMount"),
  dialogTitle: $("#dialogTitle"),
  importDialog: $("#importDialog"),
  importJson: $("#importJson"),
  toastZone: $("#toastZone")
};

setToastZone(refs.toastZone);
boot();

function boot() {
  bindEvents();
  render();
  observeSession(handleSession);
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);
}

// --- Sesión / datos ---

async function handleSession(user) {
  state.user = user;
  state.authReady = true;
  state.allowed = Boolean(user && isAllowedEmail(user.email));

  if (!user) {
    state.loading = false;
    state.data = emptyData();
    render();
    return;
  }

  if (!state.allowed) {
    state.loading = false;
    state.data = emptyData();
    render();
    toast("Sin acceso", "Esta cuenta no tiene acceso a la aplicación.", "danger");
    return;
  }

  await refreshData("Datos cargados", false);
}

async function refreshData(successMessage = "Datos actualizados", showToast = true) {
  state.loading = true;
  state.error = null;
  render();

  try {
    state.data = normalizeData(await loadAllData());
    state.loading = false;
    state.error = null;
    if (showToast) toast(successMessage, "La información quedó sincronizada.", "success");
  } catch (error) {
    console.error(error);
    state.loading = false;
    state.error = error?.message || "No se pudieron cargar los datos.";
    toast("No pudimos cargar", "Revisa tu conexión e inténtalo de nuevo.", "danger");
  }

  render();
}

function findRecord(collection, id) {
  return (state.data[collection] || []).find((item) => item.id === id) || null;
}

// --- Eventos ---

async function handleClick(event) {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    closeSheets();
    state.activeView = nav.dataset.view;
    window.scrollTo({ top: 0 });
    render();
    return;
  }

  const authButton = event.target.closest("[data-auth]");
  if (authButton) {
    closeSheets();
    if (authButton.dataset.auth === "login") await doLogin(authButton);
    if (authButton.dataset.auth === "logout") await doLogout(authButton);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  const { action: actionName, id, collection, status, type, metric, index } = action.dataset;

  try {
    switch (actionName) {
      case "open-menu":
        openSheet(refs.menuSheet);
        break;
      case "open-alerts":
        refs.alertsMount.innerHTML = state.user && state.allowed ? renderAlertsList() : "";
        openSheet(refs.alertsSheet);
        break;
      case "open-account":
        openSheet(refs.accountSheet);
        break;
      case "close-sheet":
        closeSheets();
        break;
      case "open-create":
        closeSheets();
        openRecordDialog(type || preferredTypeForView());
        break;
      case "edit-record":
        openEditDialog(collection, id);
        break;
      case "close-dialog":
        closeRecordDialog();
        break;
      case "select-record-type":
        state.activeRecordType = type;
        renderRecordDialog();
        break;
      case "set-chart-metric":
        state.trackingMetric = metric;
        render();
        break;
      case "delete-record":
        await deleteEntity(collection, id);
        break;
      case "remove-attachment":
        await removeAttachment(collection, id, Number(index));
        break;
      case "set-status":
        await setEntityStatus(collection, id, status);
        break;
      case "mark-checkup-done":
        await markCheckupDone(id);
        break;
      case "toggle-treatment":
        await toggleTreatment(id);
        break;
      case "log-dose":
        await logDose(id);
        break;
      case "export-json":
        closeSheets();
        exportJson();
        break;
      case "open-import":
        closeSheets();
        refs.importDialog.showModal();
        break;
      case "close-import":
        refs.importDialog.close();
        break;
      case "import-json":
        await doImportJson();
        break;
      case "load-demo-reset":
        localStorage.removeItem("healthtrackerac-demo-data-v2");
        await refreshData("Información de prueba reiniciada");
        break;
      case "reload":
        location.reload();
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(error);
    toast("No se pudo completar", error?.message || "Inténtalo de nuevo.", "danger");
  }
}

function handleInput(event) {
  if (event.target.matches("input[type='range']")) {
    const output = event.target.closest(".range-row")?.querySelector(".range-value");
    if (output) output.textContent = event.target.value;
  }

  if (event.target.id === "timelineSearch") {
    state.timelineSearch = event.target.value;
    const caret = event.target.selectionStart;
    render();
    // Volvemos a poner el cursor donde estaba: el listado se vuelve a dibujar.
    const field = $("#timelineSearch");
    if (field) {
      field.focus();
      field.setSelectionRange(caret, caret);
    }
  }
}

function handleChange(event) {
  if (event.target.id === "profileSelector") {
    state.selectedProfileId = event.target.value;
    render();
  }

  if (event.target.id === "timelineType") {
    state.timelineType = event.target.value;
    render();
  }

  if (event.target.name === "lastDoneDate" || event.target.name === "frequencyMonths") {
    const form = event.target.closest("form");
    if (form?.id === "recordForm" && form.dataset.recordType === "checkup") {
      const lastDone = form.lastDoneDate.value;
      const months = Number(form.frequencyMonths.value || 0);
      if (lastDone && months) form.idealNextDate.value = calculateNextDate(lastDone, months);
    }
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "quickCheckinForm") {
    event.preventDefault();
    await saveQuickCheckin(form);
    return;
  }

  if (form.id === "recordForm") {
    event.preventDefault();
    await saveRecordForm(form);
  }
}

async function doLogin(button) {
  button.disabled = true;
  try {
    await loginWithGoogle();
  } finally {
    button.disabled = false;
  }
}

async function doLogout(button) {
  button.disabled = true;
  try {
    await logoutCurrentUser();
    state.user = null;
    state.allowed = false;
    state.data = emptyData();
    toast("Sesión cerrada", "Vuelve cuando quieras.", "success");
  } finally {
    button.disabled = false;
    render();
  }
}

// --- Render ---

function render() {
  renderShellState();
  renderNav();
  renderProfileSelector();
  renderHeader();

  if (!state.authReady || state.loading) {
    refs.quickCheckin.innerHTML = "";
    refs.app.innerHTML = renderLoading();
    return;
  }

  if (!state.user) {
    refs.quickCheckin.innerHTML = "";
    refs.app.innerHTML = renderAuthState();
    return;
  }

  if (!state.allowed) {
    refs.quickCheckin.innerHTML = "";
    refs.app.innerHTML = renderBlockedState();
    return;
  }

  if (state.error) {
    refs.quickCheckin.innerHTML = "";
    refs.app.innerHTML = renderErrorState(state.error);
    return;
  }

  // El registro rápido vive en "Seguimiento": el resumen se mantiene limpio.
  refs.quickCheckin.innerHTML = state.activeView === "tracking" ? renderQuickCheckin() : "";
  refs.app.innerHTML = renderView();
}

function initials(user) {
  const source = user?.displayName || user?.email || "";
  const parts = source.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "··";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function renderShellState() {
  $$('[data-auth="login"]').forEach((button) => (button.hidden = Boolean(state.user)));
  $$('[data-auth="logout"]').forEach((button) => (button.hidden = !state.user));

  const mark = initials(state.user);
  refs.avatarInitials.textContent = mark;
  refs.accountInitials.textContent = mark;

  const alertCount = state.user && state.allowed && !state.loading ? computeAlerts(scopedData()).length : 0;
  refs.alertDot.hidden = alertCount === 0;

  if (!state.authReady) {
    refs.sessionLabel.textContent = "Un momento";
    refs.sessionHint.textContent = "Estamos abriendo tu información";
    refs.statusBanner.textContent = "";
    refs.statusBanner.className = "status-banner";
    return;
  }

  if (!state.user) {
    refs.sessionLabel.textContent = "Sin sesión";
    refs.sessionHint.textContent = "Ingresa para ver tu información";
    refs.statusBanner.textContent = "Ingresa para ver tu seguimiento.";
    refs.statusBanner.className = "status-banner";
    return;
  }

  refs.sessionLabel.textContent = state.user.displayName || state.user.email || "Sesión activa";
  refs.sessionHint.textContent = state.user.email || "";

  if (!state.allowed) {
    refs.statusBanner.textContent = "Esta cuenta no tiene acceso a la aplicación.";
    refs.statusBanner.className = "status-banner danger";
    return;
  }

  refs.statusBanner.textContent = "";
  refs.statusBanner.className = "status-banner";
}

function renderNav() {
  const counts = getNavCounts();
  // Una vista secundaria (Síntomas, Notas, Datos) mantiene "Más" resaltado.
  const activeTab = NAV_ITEMS.some((item) => item.id === state.activeView) ? state.activeView : "more";

  refs.nav.innerHTML = NAV_ITEMS.map((item) => `
    <button type="button" class="nav-button ${activeTab === item.id ? "active" : ""}" data-view="${item.id}" aria-current="${activeTab === item.id ? "page" : "false"}">
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
      ${counts[item.id] ? `<span class="nav-count">${counts[item.id]}</span>` : ""}
    </button>
  `).join("");
}

function getNavCounts() {
  if (!state.user || !state.allowed || state.loading) return {};
  const data = state.selectedProfileId === "all" ? state.data : scopedForCounts();
  return {
    appointments: upcomingAppointments(data).length + dueCheckups(data).length,
    more: activeSymptoms(data).length
  };
}

function scopedForCounts() {
  const scoped = emptyData();
  APP_CONFIG.collections.forEach((name) => {
    scoped[name] = (state.data[name] || []).filter((item) => item.profileId === state.selectedProfileId);
  });
  return scoped;
}

function renderProfileSelector() {
  const options = [
    `<option value="all" ${state.selectedProfileId === "all" ? "selected" : ""}>Todos</option>`,
    ...state.data.profiles.map((profile) => `<option value="${profile.id}" ${state.selectedProfileId === profile.id ? "selected" : ""}>${profile.name}</option>`)
  ];
  refs.profileSelector.innerHTML = options.join("");
  refs.profileSelector.disabled = !state.user || !state.allowed || state.loading;
}

function renderHeader() {
  const item = viewMeta(state.activeView);
  refs.viewTitle.textContent = item.title;
  refs.viewSubtitle.textContent = item.subtitle;
}

// --- Hojas inferiores ---

function openSheet(sheet) {
  closeSheets();
  sheet?.showModal();
}

function closeSheets() {
  [refs.menuSheet, refs.alertsSheet, refs.accountSheet].forEach((sheet) => {
    if (sheet?.open) sheet.close();
  });
}

// --- Diálogo de registro (crear / editar) ---

function openRecordDialog(type = "daily") {
  state.editingId = null;
  state.editingCollection = null;
  state.activeRecordType = type;
  renderRecordDialog();
  refs.recordDialog.showModal();
}

function openEditDialog(collection, id) {
  const record = findRecord(collection, id);
  if (!record) {
    toast("No encontrado", "No pude ubicar ese registro para editar.", "danger");
    return;
  }
  state.editingId = id;
  state.editingCollection = collection;
  state.activeRecordType = typeForCollection(collection);
  renderRecordDialog();
  refs.recordDialog.showModal();
}

function closeRecordDialog() {
  state.editingId = null;
  state.editingCollection = null;
  refs.recordDialog.close();
}

function renderRecordDialog() {
  const isEditing = Boolean(state.editingId);
  const typeMeta = RECORD_TYPES.find((item) => item.id === state.activeRecordType);
  refs.dialogTitle.textContent = isEditing ? `Editar ${typeMeta?.label || "registro"}` : (typeMeta?.label || "Registrar");

  // Al editar no se puede cambiar el tipo de registro: ocultamos el selector.
  if (isEditing) {
    refs.recordTypeGrid.innerHTML = "";
    refs.recordTypeGrid.hidden = true;
  } else {
    refs.recordTypeGrid.hidden = false;
    refs.recordTypeGrid.innerHTML = RECORD_TYPES.map((item) => `
      <button type="button" class="type-card ${state.activeRecordType === item.id ? "active" : ""}" data-action="select-record-type" data-type="${item.id}">
        <strong>${item.icon} ${item.label}</strong>
        <small>${item.hint}</small>
      </button>
    `).join("");
  }

  const values = isEditing ? findRecord(state.editingCollection, state.editingId) : null;
  refs.recordFormMount.innerHTML = renderRecordForm(state.activeRecordType, values);
}

// --- Guardado ---

async function uploadFormAttachments(form, type) {
  const fileInput = form.querySelector('input[name="attachments"]');
  if (!fileInput?.files?.length) return [];
  const folder = COLLECTION_BY_TYPE[type];
  const uploaded = [];
  for (const file of fileInput.files) {
    uploaded.push(await uploadAttachment(file, folder));
  }
  return uploaded;
}

async function saveQuickCheckin(form) {
  const data = getFormData(form);
  const record = buildRecord("daily", data);
  await createRecord("dailyLogs", record);
  form.reset();
  await refreshData("Check-in guardado", false);
  toast("Check-in guardado", "El registro diario quedó listo.", "success");
}

async function saveRecordForm(form) {
  const type = form.dataset.recordType || state.activeRecordType;
  const collection = COLLECTION_BY_TYPE[type];
  const data = getFormData(form);
  const existing = state.editingId ? findRecord(collection, state.editingId) : null;
  const record = buildRecord(type, data, existing);

  const uploaded = await uploadFormAttachments(form, type);
  if (uploaded.length) {
    record.attachments = [...(record.attachments || []), ...uploaded];
  }

  // setDoc completo: sirve igual para crear y para editar (reemplaza el doc).
  await createRecord(collection, record);
  closeRecordDialog();
  await refreshData(existing ? "Cambios guardados" : "Registro guardado", false);
  toast(existing ? "Registro actualizado" : "Registro guardado", "La información quedó sincronizada.", "success");
}

// --- Acciones sobre registros ---

async function deleteEntity(collection, id) {
  if (!collection || !id) return;
  if (!window.confirm("¿Quieres eliminar este registro? Esta acción no se puede deshacer.")) return;

  const record = findRecord(collection, id);
  await Promise.all((record?.attachments || []).map((file) => deleteAttachment(file.path)));
  await removeRecord(collection, id);
  await refreshData("Registro eliminado", false);
  toast("Registro eliminado", "Se eliminó correctamente.", "warning");
}

async function removeAttachment(collection, id, index) {
  const record = findRecord(collection, id);
  if (!record || !Array.isArray(record.attachments)) return;
  const file = record.attachments[index];
  if (!file) return;
  if (!window.confirm(`¿Quitar el adjunto "${file.name || "archivo"}"?`)) return;

  await deleteAttachment(file.path);
  const attachments = record.attachments.filter((_, position) => position !== index);
  await updateRecord(collection, id, { attachments });
  await refreshData("Adjunto eliminado", false);
  toast("Adjunto eliminado", "El archivo se quitó del registro.", "warning");
}

async function setEntityStatus(collection, id, status) {
  await updateRecord(collection, id, { status });
  await refreshData("Estado actualizado", false);
  toast("Estado actualizado", "El registro cambió de estado.", "success");
}

async function markCheckupDone(id) {
  const checkup = findRecord("checkups", id);
  if (!checkup) throw new Error("No encontré el control.");
  const today = todayISO();
  await updateRecord("checkups", id, {
    lastDoneDate: today,
    idealNextDate: calculateNextDate(today, checkup.frequencyMonths || 6),
    status: "al día"
  });
  await refreshData("Control actualizado", false);
  toast("Control al día", "Se calculó la próxima fecha ideal.", "success");
}

async function toggleTreatment(id) {
  const treatment = findRecord("treatments", id);
  if (!treatment) throw new Error("No encontré el tratamiento.");
  await updateRecord("treatments", id, { active: !treatment.active });
  await refreshData("Tratamiento actualizado", false);
}

async function logDose(id) {
  const treatment = findRecord("treatments", id);
  if (!treatment) throw new Error("No encontré el tratamiento.");
  const doseLog = [...(treatment.doseLog || []), new Date().toISOString()];
  await updateRecord("treatments", id, { doseLog });
  await refreshData("Toma registrada", false);
  toast("Toma registrada", "Quedó anotada con la hora actual.", "success");
}

// --- Backup ---

function exportJson() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: APP_CONFIG.appName, data: state.data }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `healthtrackerac-backup-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Copia guardada", "Se descargó una copia de tu información.", "success");
}

async function doImportJson() {
  const raw = refs.importJson.value.trim();
  if (!raw) throw new Error("Primero pega el contenido de tu copia.");
  const parsed = JSON.parse(raw);
  await importRecords(parsed.data || parsed);
  refs.importJson.value = "";
  refs.importDialog.close();
  await refreshData("Datos importados", false);
  toast("Copia restaurada", "Tus registros quedaron actualizados.", "success");
}

window.toggleAllBodyParts = function (buttonEl, state) {
  const container = buttonEl.closest(".body-checklist-field") || buttonEl.closest(".body-checklist-details");
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[name="bodyPartsOk"]');
  checkboxes.forEach((cb) => {
    cb.checked = state;
    cb.parentElement.classList.toggle("checked", state);
    const indicator = cb.parentElement.querySelector(".status-indicator");
    if (indicator) {
      indicator.textContent = state ? "✓ Bien" : "⚠ Novedad";
    }
  });

  const checked = state ? checkboxes.length : 0;
  const total = checkboxes.length;
  const summaryStatus = container.querySelector(".summary-status") || container.closest(".body-checklist-details")?.querySelector(".summary-status");
  if (summaryStatus) {
    if (checked === total) {
      summaryStatus.textContent = `Todos Bien (${total}/${total})`;
      summaryStatus.className = "summary-status success";
    } else if (checked === 0) {
      summaryStatus.textContent = `Todas con novedad (0/${total})`;
      summaryStatus.className = "summary-status danger";
    } else {
      summaryStatus.textContent = `${checked}/${total} Bien (novedad en ${total - checked})`;
      summaryStatus.className = "summary-status warning";
    }
  }
};

window.updateBodyChecklistSummary = function (inputEl) {
  if (!inputEl) return;
  const container = inputEl.closest(".body-checklist-field") || inputEl.closest(".body-checklist-details");
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[name="bodyPartsOk"]');
  const checked = [...checkboxes].filter((cb) => cb.checked).length;
  const total = checkboxes.length;
  const summaryStatus = container.querySelector(".summary-status") || container.closest(".body-checklist-details")?.querySelector(".summary-status");
  if (summaryStatus) {
    if (checked === total) {
      summaryStatus.textContent = `Todos Bien (${total}/${total})`;
      summaryStatus.className = "summary-status success";
    } else if (checked === 0) {
      summaryStatus.textContent = `Todas con novedad (0/${total})`;
      summaryStatus.className = "summary-status danger";
    } else {
      summaryStatus.textContent = `${checked}/${total} Bien (novedad en ${total - checked})`;
      summaryStatus.className = "summary-status warning";
    }
  }
};
