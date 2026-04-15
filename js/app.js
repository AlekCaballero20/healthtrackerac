import { renderApp, getDerivedDefaultsForCheckup } from "./ui/render.js";
import {
  getState,
  subscribe,
  setActiveView,
  setSelectedProfile,
  setTimelineFilters,
  mutateData,
  setToast
} from "./state/store.js";
import { exportData } from "./services/backup.service.js";
import {
  createRecord,
  updateRecord,
  deleteRecord
} from "./services/firestore.service.js";
import { uid, calculateNextDate } from "./services/health.service.js";

const COLLECTIONS = Object.freeze({
  BODY: "bodyStatusEntries",
  SYMPTOMS: "symptoms",
  APPOINTMENTS: "appointments",
  CHECKUPS: "checkups",
  TREATMENTS: "treatments",
  NOTES: "notes"
});

let appInitialized = false;
let renderSubscribed = false;

export function initApp() {
  if (!renderSubscribed) {
    subscribe(renderApp);
    renderSubscribed = true;
  }

  renderApp(getState());

  if (appInitialized) return;
  appInitialized = true;

  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("input", handleInput);
}

async function handleClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setActiveView(viewButton.dataset.view);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, id, collection } = actionButton.dataset;

  switch (action) {
    case "export-data":
      handleExportData();
      return;

    case "reset-data":
      handleControlledSeedNotice();
      return;

    case "resolve-symptom":
      await withActionLock(actionButton, async () => {
        await patchRecordStatus({
          collection: COLLECTIONS.SYMPTOMS,
          id,
          patch: { status: "resuelto" },
          successToast: {
            title: "Síntoma actualizado",
            message: "Quedó marcado como resuelto.",
            type: "success"
          }
        });
      });
      return;

    case "complete-appointment":
      await withActionLock(actionButton, async () => {
        await patchRecordStatus({
          collection: COLLECTIONS.APPOINTMENTS,
          id,
          patch: { status: "realizada" },
          successToast: {
            title: "Cita actualizada",
            message: "Quedó marcada como realizada.",
            type: "success"
          }
        });
      });
      return;

    case "cancel-appointment":
      await withActionLock(actionButton, async () => {
        await patchRecordStatus({
          collection: COLLECTIONS.APPOINTMENTS,
          id,
          patch: { status: "cancelada" },
          successToast: {
            title: "Cita cancelada",
            message: "El registro sigue en historial, pero su estado ya quedó claro.",
            type: "warning"
          }
        });
      });
      return;

    case "mark-checkup-done":
      await withActionLock(actionButton, async () => {
        const record = findRecord(COLLECTIONS.CHECKUPS, id);
        if (!record) {
          throw new Error("No encontré el control que intentabas actualizar.");
        }

        const today = todayISO();
        await updateEntityRecord({
          collection: COLLECTIONS.CHECKUPS,
          id,
          patch: {
            lastDoneDate: today,
            idealNextDate: calculateNextDate(today, record.frequencyMonths),
            status: "al día"
          },
          successToast: {
            title: "Control actualizado",
            message: "Ahora quedó al día y con nueva fecha sugerida.",
            type: "success"
          }
        });
      });
      return;

    case "toggle-treatment":
      await withActionLock(actionButton, async () => {
        const record = findRecord(COLLECTIONS.TREATMENTS, id);
        if (!record) {
          throw new Error("No encontré el tratamiento que intentabas actualizar.");
        }

        await updateEntityRecord({
          collection: COLLECTIONS.TREATMENTS,
          id,
          patch: { active: !record.active },
          successToast: {
            title: "Tratamiento actualizado",
            message: "Se cambió el estado del tratamiento.",
            type: "success"
          }
        });
      });
      return;

    case "toggle-reviewed":
      await withActionLock(actionButton, async () => {
        const record = findRecord(COLLECTIONS.BODY, id);
        if (!record) {
          throw new Error("No encontré el registro corporal que intentabas actualizar.");
        }

        await updateEntityRecord({
          collection: COLLECTIONS.BODY,
          id,
          patch: { reviewed: !record.reviewed },
          successToast: {
            title: "Registro corporal actualizado",
            message: "Se cambió el estado de revisión.",
            type: "success"
          }
        });
      });
      return;

    case "delete-item":
      await withActionLock(actionButton, async () => {
        await removeEntityRecord({
          collection,
          id,
          successToast: {
            title: "Registro eliminado",
            message: "El elemento se eliminó correctamente.",
            type: "warning"
          }
        });
      });
      return;

    default:
      return;
  }
}

function handleChange(event) {
  const target = event.target;

  if (target.id === "profileSelector") {
    setSelectedProfile(target.value);
    return;
  }

  if (target.id === "timelineType") {
    setTimelineFilters({ type: target.value });
    return;
  }

  if (target.name === "frequencyMonths" || target.name === "lastDoneDate") {
    const form = target.closest("form");
    if (form?.id === "checkupForm") {
      getDerivedDefaultsForCheckup(form);
    }
  }
}

function handleInput(event) {
  const target = event.target;

  if (target.id === "timelineSearch") {
    setTimelineFilters({ search: target.value });
    return;
  }

  if (target.id === "timelineType") {
    setTimelineFilters({ type: target.value });
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  event.preventDefault();

  const formData = Object.fromEntries(new FormData(form).entries());

  await withFormLock(form, async () => {
    switch (form.id) {
      case "bodyForm":
        await createBodyEntry(formData, form);
        return;
      case "symptomForm":
        await createSymptom(formData, form);
        return;
      case "appointmentForm":
        await createAppointment(formData, form);
        return;
      case "checkupForm":
        await createCheckup(formData, form);
        return;
      case "treatmentForm":
        await createTreatment(formData, form);
        return;
      case "noteForm":
        await createNote(formData, form);
        return;
      default:
        return;
    }
  });
}

function handleExportData() {
  const state = getState();

  if (!state.app?.isDataReady) {
    setToast({
      title: "Datos no disponibles",
      message: "Todavía no hay información cargada para exportar.",
      type: "warning"
    });
    return;
  }

  exportData(state.data);

  setToast({
    title: "Backup exportado",
    message: "Se descargó el JSON actual de la app.",
    type: "success"
  });
}

function handleControlledSeedNotice() {
  setToast({
    title: "Seed controlado pendiente",
    message:
      "Este botón quedó reservado para una carga inicial controlada en Firestore. No hace restore local.",
    type: "warning"
  });
}

async function createBodyEntry(data, form) {
  const profileId = requireProfileId(data.profileId);
  const now = nowISO();

  const record = {
    id: uid("body"),
    profileId,
    bodyPart: requiredText(data.bodyPart, "Debes elegir una parte del cuerpo."),
    status: requiredText(data.status, "Debes elegir un estado actual."),
    symptom: requiredText(data.symptom, "Debes escribir la molestia o síntoma."),
    intensity: toNumber(data.intensity, 1),
    frequency: requiredText(data.frequency, "Debes elegir la frecuencia."),
    startDate: requiredText(data.startDate, "Debes indicar la fecha de inicio."),
    observations: optionalText(data.observations),
    requiresAppointment: Boolean(form.requiresAppointment?.checked),
    reviewed: Boolean(form.reviewed?.checked),
    createdAt: now,
    updatedAt: now
  };

  await createEntityRecord({
    collection: COLLECTIONS.BODY,
    record,
    successToast: {
      title: "Registro guardado",
      message: "La parte del cuerpo quedó registrada correctamente.",
      type: "success"
    },
    onSuccess: () => form.reset()
  });
}

async function createSymptom(data, form) {
  const profileId = requireProfileId(data.profileId);
  const now = nowISO();

  const record = {
    id: uid("sym"),
    profileId,
    name: requiredText(data.name, "Debes escribir el nombre del síntoma."),
    bodyPart: requiredText(data.bodyPart, "Debes elegir la parte del cuerpo relacionada."),
    intensity: toNumber(data.intensity, 1),
    duration: requiredText(data.duration, "Debes escribir la duración."),
    frequency: requiredText(data.frequency, "Debes elegir la frecuencia."),
    startDate: requiredText(data.startDate, "Debes indicar la fecha de inicio."),
    triggers: optionalText(data.triggers),
    trend: optionalText(data.trend),
    notes: optionalText(data.notes),
    status: requiredText(data.status, "Debes elegir el estado del síntoma."),
    createdAt: now,
    updatedAt: now
  };

  await createEntityRecord({
    collection: COLLECTIONS.SYMPTOMS,
    record,
    successToast: {
      title: "Síntoma guardado",
      message: "Ya quedó listo para historial, alertas y dashboard.",
      type: "success"
    },
    onSuccess: () => form.reset()
  });
}

async function createAppointment(data, form) {
  const profileId = requireProfileId(data.profileId);
  const now = nowISO();

  const record = {
    id: uid("apt"),
    profileId,
    specialty: requiredText(data.specialty, "Debes elegir la especialidad."),
    doctor: optionalText(data.doctor),
    date: requiredText(data.date, "Debes indicar la fecha de la cita."),
    time: requiredText(data.time, "Debes indicar la hora de la cita."),
    location: optionalText(data.location),
    reason: requiredText(data.reason, "Debes escribir el motivo de la cita."),
    status: requiredText(data.status, "Debes elegir el estado de la cita."),
    result: optionalText(data.result),
    nextSteps: optionalText(data.nextSteps),
    notes: optionalText(data.notes),
    createdAt: now,
    updatedAt: now
  };

  await createEntityRecord({
    collection: COLLECTIONS.APPOINTMENTS,
    record,
    successToast: {
      title: "Cita guardada",
      message: "La agenda médica ya quedó actualizada.",
      type: "success"
    },
    onSuccess: () => form.reset()
  });
}

async function createCheckup(data, form) {
  const profileId = requireProfileId(data.profileId);
  const now = nowISO();
  const frequencyMonths = toNumber(data.frequencyMonths, 1);
  const lastDoneDate = requiredText(
    data.lastDoneDate,
    "Debes indicar la última vez realizado."
  );
  const idealNextDate =
    optionalText(data.idealNextDate) || calculateNextDate(lastDoneDate, frequencyMonths);

  const record = {
    id: uid("chk"),
    profileId,
    name: requiredText(data.name, "Debes elegir el nombre del control."),
    frequencyMonths,
    lastDoneDate,
    idealNextDate,
    status: requiredText(data.status, "Debes elegir el estado del control."),
    observations: optionalText(data.observations),
    priority: requiredText(data.priority, "Debes elegir la prioridad."),
    createdAt: now,
    updatedAt: now
  };

  await createEntityRecord({
    collection: COLLECTIONS.CHECKUPS,
    record,
    successToast: {
      title: "Control guardado",
      message: "Ya aparece en pendientes y alertas cuando corresponda.",
      type: "success"
    },
    onSuccess: () => form.reset()
  });
}

async function createTreatment(data, form) {
  const profileId = requireProfileId(data.profileId);
  const now = nowISO();

  const record = {
    id: uid("trt"),
    profileId,
    medication: requiredText(
      data.medication,
      "Debes escribir el medicamento o tratamiento."
    ),
    dosage: requiredText(data.dosage, "Debes escribir la dosis."),
    schedule: requiredText(data.schedule, "Debes escribir el horario."),
    reason: requiredText(data.reason, "Debes escribir el motivo."),
    startDate: requiredText(data.startDate, "Debes indicar la fecha de inicio."),
    endDate: optionalText(data.endDate),
    active: Boolean(form.active?.checked),
    indications: optionalText(data.indications),
    sideEffects: optionalText(data.sideEffects),
    notes: optionalText(data.notes),
    createdAt: now,
    updatedAt: now
  };

  await createEntityRecord({
    collection: COLLECTIONS.TREATMENTS,
    record,
    successToast: {
      title: "Tratamiento guardado",
      message: "Quedó en seguimiento y visible en el resumen.",
      type: "success"
    },
    onSuccess: () => form.reset()
  });
}

async function createNote(data, form) {
  const profileId = requireProfileId(data.profileId);
  const now = nowISO();

  const record = {
    id: uid("note"),
    profileId,
    title: requiredText(data.title, "Debes escribir el título de la nota."),
    moodTag: optionalText(data.moodTag),
    content: requiredText(data.content, "Debes escribir el contenido de la nota."),
    createdAt: now,
    updatedAt: now
  };

  await createEntityRecord({
    collection: COLLECTIONS.NOTES,
    record,
    successToast: {
      title: "Nota guardada",
      message: "Ya quedó dentro del historial y el perfil correspondiente.",
      type: "success"
    },
    onSuccess: () => form.reset()
  });
}

async function createEntityRecord({ collection, record, successToast, onSuccess }) {
  ensureWritableState();
  ensureValidCollection(collection);

  await createRecord(collection, record);

  mutateData((data) => {
    data[collection] = [record, ...data[collection]];
    return data;
  });

  if (typeof onSuccess === "function") {
    onSuccess();
  }

  if (successToast) {
    setToast(successToast);
  }
}

async function updateEntityRecord({ collection, id, patch, successToast }) {
  ensureWritableState();
  ensureValidCollection(collection);

  const current = findRecord(collection, id);
  if (!current) {
    throw new Error("No encontré el registro que intentabas actualizar.");
  }

  const nextPatch = {
    ...patch,
    updatedAt: nowISO()
  };

  await updateRecord(collection, id, nextPatch);

  mutateData((data) => {
    data[collection] = data[collection].map((item) =>
      item.id === id ? { ...item, ...nextPatch } : item
    );
    return data;
  });

  if (successToast) {
    setToast(successToast);
  }
}

async function patchRecordStatus({ collection, id, patch, successToast }) {
  await updateEntityRecord({
    collection,
    id,
    patch,
    successToast
  });
}

async function removeEntityRecord({ collection, id, successToast }) {
  ensureWritableState();
  ensureValidCollection(collection);

  const current = findRecord(collection, id);
  if (!current) {
    throw new Error("No encontré el registro que intentabas eliminar.");
  }

  await deleteRecord(collection, id);

  mutateData((data) => {
    data[collection] = data[collection].filter((item) => item.id !== id);
    return data;
  });

  if (successToast) {
    setToast(successToast);
  }
}

function ensureWritableState() {
  const state = getState();

  if (!state.auth?.isAllowed) {
    throw new Error("La sesión actual no tiene permisos para modificar datos.");
  }

  if (!state.app?.isDataReady) {
    throw new Error("La información aún no está lista para edición.");
  }
}

function findRecord(collection, id) {
  ensureValidCollection(collection);

  const state = getState();
  const items = Array.isArray(state.data?.[collection]) ? state.data[collection] : [];
  return items.find((item) => item.id === id) || null;
}

function ensureValidCollection(collection) {
  if (!Object.values(COLLECTIONS).includes(collection)) {
    throw new Error(`Colección no permitida: ${collection}`);
  }
}

async function withActionLock(element, callback) {
  if (!(element instanceof HTMLElement)) {
    await runSafely(callback);
    return;
  }

  const wasDisabled = "disabled" in element ? element.disabled : false;

  if ("disabled" in element) {
    element.disabled = true;
  }

  try {
    await runSafely(callback);
  } finally {
    if ("disabled" in element) {
      element.disabled = wasDisabled;
    }
  }
}

async function withFormLock(form, callback) {
  const submitButton = form.querySelector('[type="submit"]');
  const allFields = form.querySelectorAll("input, select, textarea, button");

  allFields.forEach((field) => {
    field.dataset.wasDisabled = String(field.disabled);
    field.disabled = true;
  });

  try {
    await runSafely(callback);
  } finally {
    allFields.forEach((field) => {
      field.disabled = field.dataset.wasDisabled === "true";
      delete field.dataset.wasDisabled;
    });

    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function runSafely(callback) {
  try {
    await callback();
  } catch (error) {
    console.error("[app] Error:", error);

    setToast({
      title: "No se pudo completar la acción",
      message:
        error?.message ||
        "Ocurrió un problema guardando o actualizando la información.",
      type: "error"
    });
  }
}

function requireProfileId(value) {
  const profileId = String(value || "").trim();
  if (!profileId) {
    throw new Error("Debes seleccionar un perfil.");
  }
  return profileId;
}

function requiredText(value, errorMessage) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function optionalText(value) {
  return String(value || "").trim();
}

function toNumber(value, min = null) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error("Hay un valor numérico inválido en el formulario.");
  }

  if (min !== null && numeric < min) {
    throw new Error(`El valor debe ser mayor o igual a ${min}.`);
  }

  return numeric;
}

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}