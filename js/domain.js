// Lógica de dominio: cálculos de salud sobre los datos. Funciones puras que
// reciben "data" (resultado de scopedData) y devuelven derivados.

import {
  daysBetween,
  daysSince,
  formatDate,
  sortDesc,
  todayISO,
  toneByIntensity,
  toneByPain
} from "./utils.js";
import { profileName } from "./state.js";
import { BODY_PARTS } from "./config.js";

const OPEN_SYMPTOM_STATES = ["activo", "en observación", "mejorando"];
const OPEN_APPOINTMENT_STATES = ["agendada", "pendiente"];

export function activeSymptoms(data) {
  return data.symptoms.filter((item) => OPEN_SYMPTOM_STATES.includes(item.status));
}

export function upcomingAppointments(data) {
  return data.appointments.filter(
    (item) => OPEN_APPOINTMENT_STATES.includes(item.status) && daysBetween(item.date) >= -1
  );
}

export function dueCheckups(data) {
  return data.checkups.filter(
    (item) => item.status === "atrasado" || daysBetween(item.idealNextDate) < 0
  );
}

export function activeTreatments(data) {
  return data.treatments.filter((item) => item.active);
}

// --- Adherencia de tratamientos ---

export function dosesOn(treatment, isoDate) {
  return (treatment.doseLog || []).filter((stamp) => String(stamp).slice(0, 10) === isoDate).length;
}

export function dosesToday(treatment) {
  return dosesOn(treatment, todayISO());
}

export function dosesThisWeek(treatment) {
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  return (treatment.doseLog || []).filter((stamp) => String(stamp).slice(0, 10) >= weekAgo).length;
}

export function lastDose(treatment) {
  const log = treatment.doseLog || [];
  if (!log.length) return null;
  return [...log].sort().at(-1);
}

export function summarize(data) {
  return {
    activeSymptoms: activeSymptoms(data).length,
    upcomingAppointments: upcomingAppointments(data).length,
    dueCheckups: dueCheckups(data).length,
    activeTreatments: activeTreatments(data).length
  };
}

export function computeAlerts(data) {
  const alerts = [];

  data.symptoms.forEach((symptom) => {
    if (OPEN_SYMPTOM_STATES.includes(symptom.status) && Number(symptom.intensity) >= 7) {
      alerts.push({
        level: "danger",
        title: `${symptom.name}: intensidad alta`,
        description: `${symptom.bodyPart} está en ${symptom.intensity}/10.`,
        profileName: profileName(symptom.profileId),
        profileId: symptom.profileId
      });
    }
    const openDays = daysSince(symptom.startDate);
    if (["activo", "en observación"].includes(symptom.status) && openDays >= 14) {
      alerts.push({
        level: "warning",
        title: `${symptom.name}: lleva ${openDays} días`,
        description: "Conviene revisar evolución, gatillos o próximos pasos.",
        profileName: profileName(symptom.profileId),
        profileId: symptom.profileId
      });
    }
  });

  data.appointments.forEach((appointment) => {
    const diff = daysBetween(appointment.date);
    if (OPEN_APPOINTMENT_STATES.includes(appointment.status) && diff < 0) {
      alerts.push({ level: "danger", title: `${appointment.specialty}: cita vencida`, description: `Era el ${formatDate(appointment.date)}.`, profileName: profileName(appointment.profileId), profileId: appointment.profileId });
    } else if (OPEN_APPOINTMENT_STATES.includes(appointment.status) && diff <= 7) {
      alerts.push({ level: "info", title: `${appointment.specialty}: cita próxima`, description: `Faltan ${diff} días.`, profileName: profileName(appointment.profileId), profileId: appointment.profileId });
    }
  });

  data.checkups.forEach((checkup) => {
    if (checkup.status === "atrasado" || daysBetween(checkup.idealNextDate) < 0) {
      alerts.push({ level: "warning", title: `${checkup.name}: control atrasado`, description: `Fecha ideal: ${formatDate(checkup.idealNextDate)}.`, profileName: profileName(checkup.profileId), profileId: checkup.profileId });
    }
  });

  data.treatments.forEach((treatment) => {
    if (!treatment.active || !treatment.endDate) return;
    const diff = daysBetween(treatment.endDate);
    if (diff < 0) {
      alerts.push({ level: "warning", title: `${treatment.medication}: revisar continuidad`, description: `Terminaba el ${formatDate(treatment.endDate)}.`, profileName: profileName(treatment.profileId), profileId: treatment.profileId });
    } else if (diff <= 3) {
      alerts.push({ level: "info", title: `${treatment.medication}: por terminar`, description: `Termina el ${formatDate(treatment.endDate)} (${diff} día${diff === 1 ? "" : "s"}).`, profileName: profileName(treatment.profileId), profileId: treatment.profileId });
    }
  });

  const weight = { danger: 3, warning: 2, info: 1 };
  return alerts.sort((a, b) => weight[b.level] - weight[a.level]);
}

export function buildTimeline(data) {
  const rows = [];
  data.dailyLogs.forEach((item) => {
    let bodyDesc = "";
    if (item.bodyPartsOk) {
      const okCount = item.bodyPartsOk.length;
      const total = BODY_PARTS.length;
      if (okCount === total) {
        bodyDesc = " · Cuerpo: Todo Bien ✓";
      } else {
        const details = BODY_PARTS.filter((p) => !item.bodyPartsOk.includes(p)).join(", ");
        bodyDesc = ` · Cuerpo: ${okCount}/${total} Bien (novedad en: ${details})`;
      }
    }
    const description = (item.note ? `${item.note} | ` : "") + `Dolor ${item.painLevel ?? 0}/10 · Sueño ${item.sleepHours ?? "-"} h${bodyDesc}`;
    
    rows.push({
      type: "daily",
      profileId: item.profileId,
      profileName: profileName(item.profileId),
      title: `Check-in: energía ${item.energy ?? "-"}/10`,
      description,
      createdAt: `${item.date || todayISO()}T12:00:00`,
      meta: item.mood || "diario",
      tone: toneByPain(item.painLevel)
    });
  });
  data.symptoms.forEach((item) => rows.push({ type: "symptom", profileId: item.profileId, profileName: profileName(item.profileId), title: item.name, description: item.notes || item.triggers || item.bodyPart || "Síntoma registrado", createdAt: item.createdAt || item.startDate, meta: `${item.status || "activo"} · ${item.intensity ?? "-"}/10`, tone: toneByIntensity(item.intensity) }));
  data.bodyStatusEntries.forEach((item) => rows.push({ type: "body", profileId: item.profileId, profileName: profileName(item.profileId), title: `${item.bodyPart}: ${item.status}`, description: item.symptom || item.observations || "Registro corporal", createdAt: item.createdAt || item.startDate, meta: `${item.frequency || ""} · ${item.intensity ?? "-"}/10`, tone: toneByIntensity(item.intensity) }));
  data.appointments.forEach((item) => rows.push({ type: "appointment", profileId: item.profileId, profileName: profileName(item.profileId), title: `${item.specialty}: ${item.reason}`, description: item.notes || item.location || "Cita médica", createdAt: `${item.date || todayISO()}T${item.time || "09:00"}:00`, meta: item.status, tone: appointmentTone(item) }));
  data.checkups.forEach((item) => rows.push({ type: "checkup", profileId: item.profileId, profileName: profileName(item.profileId), title: item.name, description: item.observations || `Cada ${item.frequencyMonths || "?"} meses`, createdAt: `${item.idealNextDate || item.createdAt || todayISO()}T09:00:00`, meta: item.status, tone: item.status === "atrasado" ? "warning" : "success" }));
  data.treatments.forEach((item) => rows.push({ type: "treatment", profileId: item.profileId, profileName: profileName(item.profileId), title: item.medication, description: item.notes || item.dose || "Tratamiento", createdAt: item.createdAt || item.startDate, meta: item.active ? "activo" : "pausado", tone: item.active ? "success" : "neutral" }));
  data.notes.forEach((item) => rows.push({ type: "note", profileId: item.profileId, profileName: profileName(item.profileId), title: item.title, description: item.content, createdAt: item.createdAt || item.date, meta: item.category, tone: "neutral" }));
  return sortDesc(rows, "createdAt");
}

export function appointmentTone(item) {
  if (item.status === "realizada") return "success";
  if (item.status === "cancelada") return "neutral";
  const diff = daysBetween(item.date);
  if (diff < 0) return "danger";
  if (diff <= 7) return "warning";
  return "info";
}

// Serie temporal para gráficas a partir de los check-ins diarios.
export function metricSeries(logs, field, limit = 14) {
  return sortDesc(logs, "date")
    .slice(0, limit)
    .reverse()
    .map((log) => ({ date: log.date, value: Number(log[field] || 0) }));
}
