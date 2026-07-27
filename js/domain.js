// Lógica de dominio: cálculos de salud sobre los datos. Funciones puras que
// reciben "data" (resultado de scopedData) y devuelven derivados.

import {
  daysBetween,
  daysSince,
  formatDate,
  sortAsc,
  sortDesc,
  todayISO,
  toneByIntensity,
  toneByPain
} from "./utils.js";
import { profileName } from "./state.js";
import { BODY_MAP, BODY_PARTS, BP_LEVELS } from "./config.js";

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

  const latest = latestVitals(data);
  if (latest) {
    const level = bpLevel(latest.systolic, latest.diastolic);
    if (level && (level.tone === "danger" || level.id === "alta-1" || level.id === "baja")) {
      alerts.push({
        level: level.tone === "danger" ? "danger" : "warning",
        title: `Presión ${level.label.toLowerCase()}`,
        description: `Última toma: ${latest.systolic}/${latest.diastolic} el ${formatDate(latest.date)}.`,
        profileName: profileName(latest.profileId),
        profileId: latest.profileId
      });
    }
  }

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
  (data.vitals || []).forEach((item) => {
    const level = bpLevel(item.systolic, item.diastolic);
    rows.push({
      type: "vitals",
      profileId: item.profileId,
      profileName: profileName(item.profileId),
      title: `Presión ${item.systolic}/${item.diastolic}`,
      description: [item.pulse ? `Pulso ${item.pulse}` : "", item.moment, item.notes].filter(Boolean).join(" · ") || "Toma de presión",
      createdAt: `${item.date || todayISO()}T${item.time || "08:00"}:00`,
      meta: level ? level.label : "",
      tone: level ? level.tone : "neutral"
    });
  });
  data.notes.forEach((item) => rows.push({ type: "note", profileId: item.profileId, profileName: profileName(item.profileId), title: item.title, description: item.content, createdAt: item.createdAt || item.date, meta: item.category, tone: "neutral" }));
  return sortDesc(rows, "createdAt");
}

// --- Presión arterial ---

// Clasifica una toma. Es una referencia informativa, no un diagnóstico.
export function bpLevel(systolic, diastolic) {
  const sys = Number(systolic || 0);
  const dia = Number(diastolic || 0);
  if (!sys || !dia) return null;
  return BP_LEVELS.find((level) => level.test(sys, dia)) || null;
}

export function sortedVitals(data) {
  return sortDesc(data.vitals || [], "date");
}

export function latestVitals(data) {
  return sortedVitals(data)[0] || null;
}

// Promedio de las tomas de los últimos días (por defecto, una semana).
export function bpAverage(data, days = 7) {
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const list = (data.vitals || []).filter((item) => String(item.date || "") >= since);
  if (!list.length) return null;
  const avg = (field) => Math.round(list.reduce((sum, item) => sum + Number(item[field] || 0), 0) / list.length);
  return { systolic: avg("systolic"), diastolic: avg("diastolic"), count: list.length };
}

// Serie para la gráfica: un punto por día (el promedio si hubo varias tomas).
export function bpSeries(data, limit = 7) {
  const byDate = new Map();
  (data.vitals || []).forEach((item) => {
    if (!item.date) return;
    const bucket = byDate.get(item.date) || [];
    bucket.push(item);
    byDate.set(item.date, bucket);
  });
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, limit)
    .reverse()
    .map(([date, list]) => ({
      date,
      value: Math.round(list.reduce((sum, item) => sum + Number(item.systolic || 0), 0) / list.length),
      low: Math.round(list.reduce((sum, item) => sum + Number(item.diastolic || 0), 0) / list.length)
    }));
}

// --- Mapa del cuerpo ---

// Devuelve todo lo registrado que apunta a una zona concreta del cuerpo.
export function recordsForZone(data, zone) {
  const rows = [];
  data.symptoms.forEach((item) => {
    if (item.bodyPart === zone) rows.push({ kind: "symptom", collection: "symptoms", item, date: item.startDate || item.createdAt });
  });
  data.bodyStatusEntries.forEach((item) => {
    if (item.bodyPart === zone) rows.push({ kind: "body", collection: "bodyStatusEntries", item, date: item.startDate || item.createdAt });
  });
  data.appointments.forEach((item) => {
    if (item.bodyPart === zone) rows.push({ kind: "appointment", collection: "appointments", item, date: item.date });
  });
  data.checkups.forEach((item) => {
    if (item.bodyPart === zone) rows.push({ kind: "checkup", collection: "checkups", item, date: item.idealNextDate || item.createdAt });
  });
  data.treatments.forEach((item) => {
    if (item.bodyPart === zone) rows.push({ kind: "treatment", collection: "treatments", item, date: item.startDate || item.createdAt });
  });
  data.notes.forEach((item) => {
    if (item.bodyPart === zone) rows.push({ kind: "note", collection: "notes", item, date: item.date || item.createdAt });
  });
  return sortDesc(rows, "date");
}

// Estado de una zona: "danger", "warning", "ok" o "empty".
export function zoneStatus(data, zone) {
  const open = data.symptoms.filter(
    (item) => item.bodyPart === zone && OPEN_SYMPTOM_STATES.includes(item.status)
  );
  const openBody = data.bodyStatusEntries.filter(
    (item) => item.bodyPart === zone && !item.reviewed
  );

  if (open.some((item) => Number(item.intensity) >= 7) || openBody.some((item) => Number(item.intensity) >= 7)) {
    return "danger";
  }
  if (open.length || openBody.length) return "warning";

  // Si la zona quedó sin marcar en el último chequeo rápido, también avisa.
  const lastLog = sortDesc(data.dailyLogs, "date")[0];
  if (lastLog && Array.isArray(lastLog.bodyPartsOk) && !lastLog.bodyPartsOk.includes(zone)) {
    return "warning";
  }

  return recordsForZone(data, zone).length ? "ok" : "empty";
}

const STATUS_WEIGHT = { danger: 3, warning: 2, ok: 1, empty: 0 };

// Resumen por sección: estado peor de sus zonas y cuántas necesitan atención.
export function bodyMapSummary(data) {
  return BODY_MAP.map((section) => {
    const zones = section.zones.map((zone) => ({
      zone,
      status: zoneStatus(data, zone),
      count: recordsForZone(data, zone).length
    }));
    const status = zones.reduce(
      (worst, item) => (STATUS_WEIGHT[item.status] > STATUS_WEIGHT[worst] ? item.status : worst),
      "empty"
    );
    return {
      ...section,
      zones,
      status,
      attention: zones.filter((item) => item.status === "danger" || item.status === "warning").length,
      records: zones.reduce((sum, item) => sum + item.count, 0)
    };
  });
}

// --- Derivados para el resumen del día ---

// Controles vencidos o que vencen dentro del próximo mes.
export function pendingCheckups(data) {
  return data.checkups.filter((item) => {
    const diff = daysBetween(item.idealNextDate);
    return item.status === "atrasado" || diff <= 30;
  });
}

export function nextAppointment(data) {
  return sortAsc(upcomingAppointments(data), "date")[0] || null;
}

// Fecha del síntoma o registro corporal más reciente (ISO o null).
export function lastSymptomDate(data) {
  const dates = [
    ...data.symptoms.map((item) => item.startDate || item.createdAt),
    ...data.bodyStatusEntries.map((item) => item.startDate || item.createdAt)
  ].filter(Boolean);
  if (!dates.length) return null;
  return dates.sort().at(-1);
}

// Últimos 7 días con registro, en orden cronológico.
export function weekSeries(logs, field) {
  return metricSeries(logs, field, 7);
}

// Compara la primera mitad con la segunda para describir la tendencia.
export function trendLabel(series) {
  if (series.length < 3) return null;
  const half = Math.floor(series.length / 2);
  const avg = (list) => list.reduce((sum, item) => sum + item.value, 0) / (list.length || 1);
  const diff = avg(series.slice(half)) - avg(series.slice(0, half));
  if (Math.abs(diff) < 0.8) return { text: "Estable", tone: "success" };
  return diff > 0 ? { text: "En aumento", tone: "warning" } : { text: "A la baja", tone: "warning" };
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
