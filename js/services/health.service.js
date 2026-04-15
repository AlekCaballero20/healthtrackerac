const DAY_IN_MS = 1000 * 60 * 60 * 24;

export function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sortByDateDesc(items, fieldOptions = ["createdAt", "date", "startDate", "idealNextDate"]) {
  return [...items].sort((a, b) => getComparableDate(b, fieldOptions) - getComparableDate(a, fieldOptions));
}

export function getComparableDate(item, fieldOptions) {
  const field = fieldOptions.find((key) => item?.[key]);
  if (!field) return 0;
  return new Date(item[field]).getTime();
}

export function formatDate(dateString) {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium"
  }).format(new Date(dateString));
}

export function formatDateTime(dateString) {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(dateString));
}

export function daysBetween(dateString, base = new Date()) {
  if (!dateString) return null;
  const diff = new Date(dateString).setHours(0, 0, 0, 0) - new Date(base).setHours(0, 0, 0, 0);
  return Math.round(diff / DAY_IN_MS);
}

export function daysSince(dateString) {
  if (!dateString) return null;
  const diff = new Date().setHours(0, 0, 0, 0) - new Date(dateString).setHours(0, 0, 0, 0);
  return Math.round(diff / DAY_IN_MS);
}

export function calculateNextDate(lastDoneDate, frequencyMonths) {
  if (!lastDoneDate || !frequencyMonths) return "";
  const date = new Date(lastDoneDate);
  date.setMonth(date.getMonth() + Number(frequencyMonths));
  return date.toISOString().slice(0, 10);
}

export function scopeByProfile(records, profileId) {
  if (profileId === "all") return records;
  return records.filter((record) => record.profileId === profileId);
}

export function getProfile(data, profileId) {
  return data.profiles.find((profile) => profile.id === profileId);
}

export function getProfileName(data, profileId) {
  return getProfile(data, profileId)?.name || "Sin perfil";
}

export function severityTone(intensity = 0) {
  if (intensity >= 7) return "danger";
  if (intensity >= 4) return "warning";
  return "success";
}

export function priorityTone(priority = "media") {
  if (["alta", "urgente"].includes(priority)) return "danger";
  if (priority === "media") return "warning";
  return "success";
}

export function appointmentTone(status, date) {
  if (status === "cancelada") return "warning";
  if (status === "realizada") return "success";
  const diff = daysBetween(date);
  if (diff !== null && diff < 0) return "danger";
  if (diff !== null && diff <= 7) return "warning";
  return "info";
}

export function checkupTone(checkup) {
  if (checkup.status === "atrasado") return "danger";
  if (checkup.status === "por vencer") return "warning";
  return "success";
}

export function summarizeProfile(data, profileId) {
  const bodyEntries = sortByDateDesc(scopeByProfile(data.bodyStatusEntries, profileId));
  const symptoms = sortByDateDesc(scopeByProfile(data.symptoms, profileId));
  const appointments = scopeByProfile(data.appointments, profileId);
  const checkups = scopeByProfile(data.checkups, profileId);
  const treatments = scopeByProfile(data.treatments, profileId);
  const notes = sortByDateDesc(scopeByProfile(data.notes, profileId));

  const upcomingAppointments = appointments
    .filter((item) => ["pendiente", "agendada"].includes(item.status))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const overdueCheckups = checkups.filter((item) => item.status === "atrasado");
  const activeSymptoms = symptoms.filter((item) => item.status === "activo" || item.status === "en observación");
  const activeTreatments = treatments.filter((item) => item.active);
  const recentBodyEntries = bodyEntries.slice(0, 5);

  return {
    totalSymptoms: activeSymptoms.length,
    totalAppointments: upcomingAppointments.length,
    totalCheckups: overdueCheckups.length,
    totalTreatments: activeTreatments.length,
    latestSymptom: activeSymptoms[0] || null,
    nextAppointment: upcomingAppointments[0] || null,
    overdueCheckups,
    activeSymptoms,
    activeTreatments,
    recentBodyEntries,
    recentNotes: notes.slice(0, 3)
  };
}

export function computeAlerts(data, profileId = "all") {
  const symptoms = scopeByProfile(data.symptoms, profileId);
  const appointments = scopeByProfile(data.appointments, profileId);
  const checkups = scopeByProfile(data.checkups, profileId);
  const treatments = scopeByProfile(data.treatments, profileId);
  const alerts = [];

  symptoms.forEach((symptom) => {
    const daysOpen = daysSince(symptom.startDate);
    if ((symptom.status === "activo" || symptom.status === "en observación") && Number(symptom.intensity) >= 7) {
      alerts.push({
        id: `alert-${symptom.id}-high`,
        profileId: symptom.profileId,
        level: "danger",
        title: `${symptom.name}: intensidad alta`,
        description: `Está en ${symptom.intensity}/10 y sigue ${symptom.status}.`,
        sourceType: "symptom"
      });
    }

    if ((symptom.status === "activo" || symptom.status === "en observación") && daysOpen >= 14) {
      alerts.push({
        id: `alert-${symptom.id}-long`,
        profileId: symptom.profileId,
        level: "warning",
        title: `${symptom.name}: lleva tiempo activo`,
        description: `Se registra desde hace ${daysOpen} días.`,
        sourceType: "symptom"
      });
    }
  });

  appointments.forEach((appointment) => {
    const diff = daysBetween(appointment.date);
    if (["pendiente", "agendada"].includes(appointment.status) && diff < 0) {
      alerts.push({
        id: `alert-${appointment.id}-missed`,
        profileId: appointment.profileId,
        level: "danger",
        title: `${appointment.specialty}: cita vencida`,
        description: `La fecha era ${formatDate(appointment.date)} y sigue ${appointment.status}.`,
        sourceType: "appointment"
      });
    }
    if (["pendiente", "agendada"].includes(appointment.status) && diff >= 0 && diff <= 7) {
      alerts.push({
        id: `alert-${appointment.id}-soon`,
        profileId: appointment.profileId,
        level: "info",
        title: `${appointment.specialty}: cita próxima`,
        description: `Falta ${diff} ${diff === 1 ? "día" : "días"} para la cita.`,
        sourceType: "appointment"
      });
    }
  });

  checkups.forEach((checkup) => {
    const diff = daysBetween(checkup.idealNextDate);
    if (checkup.status === "atrasado" || diff < 0) {
      alerts.push({
        id: `alert-${checkup.id}-late`,
        profileId: checkup.profileId,
        level: "warning",
        title: `${checkup.name}: control atrasado`,
        description: `La próxima fecha ideal era ${formatDate(checkup.idealNextDate)}.`,
        sourceType: "checkup"
      });
    }
  });

  treatments.forEach((treatment) => {
    const diff = daysBetween(treatment.endDate);
    if (treatment.active && diff !== null && diff < 0) {
      alerts.push({
        id: `alert-${treatment.id}-follow`,
        profileId: treatment.profileId,
        level: "warning",
        title: `${treatment.medication}: revisar continuidad`,
        description: `La duración terminó el ${formatDate(treatment.endDate)} y sigue marcado activo.`,
        sourceType: "treatment"
      });
    }
  });

  return alerts.sort((a, b) => {
    const weight = { danger: 3, warning: 2, info: 1 };
    return weight[b.level] - weight[a.level];
  });
}

export function computeSemaphore(alerts) {
  const levels = alerts.map((alert) => alert.level);
  if (levels.includes("danger")) {
    return {
      tone: "danger",
      label: "Atención prioritaria"
    };
  }
  if (levels.includes("warning")) {
    return {
      tone: "warning",
      label: "Conviene revisar pendientes"
    };
  }
  return {
    tone: "success",
    label: "Bastante estable"
  };
}

export function buildTimeline(data, profileId = "all") {
  const bodyEntries = scopeByProfile(data.bodyStatusEntries, profileId).map((item) => ({
    id: item.id,
    profileId: item.profileId,
    type: "body",
    title: `${item.bodyPart}: ${item.status}`,
    description: item.symptom || item.observations || "Sin detalle adicional",
    createdAt: item.createdAt,
    meta: `${item.intensity}/10 · ${item.frequency}`
  }));

  const symptoms = scopeByProfile(data.symptoms, profileId).map((item) => ({
    id: item.id,
    profileId: item.profileId,
    type: "symptom",
    title: item.name,
    description: item.notes || item.trend || "Sin observaciones",
    createdAt: item.createdAt,
    meta: `${item.bodyPart} · ${item.status} · ${item.intensity}/10`
  }));

  const appointments = scopeByProfile(data.appointments, profileId).map((item) => ({
    id: item.id,
    profileId: item.profileId,
    type: "appointment",
    title: `${item.specialty}: ${item.reason}`,
    description: item.result || item.nextSteps || item.notes || "Cita médica registrada",
    createdAt: `${item.date}T${item.time || "08:00"}:00`,
    meta: `${item.status} · ${item.location || item.entity || "Sin lugar"}`
  }));

  const checkups = scopeByProfile(data.checkups, profileId).map((item) => ({
    id: item.id,
    profileId: item.profileId,
    type: "checkup",
    title: `${item.name}: ${item.status}`,
    description: item.observations || "Control registrado",
    createdAt: `${item.idealNextDate || item.createdAt}`,
    meta: `Próxima fecha ideal: ${formatDate(item.idealNextDate)}`
  }));

  const treatments = scopeByProfile(data.treatments, profileId).map((item) => ({
    id: item.id,
    profileId: item.profileId,
    type: "treatment",
    title: item.medication,
    description: item.reason || item.indications || "Tratamiento activo",
    createdAt: item.createdAt,
    meta: `${item.active ? "Activo" : "Finalizado"} · ${item.schedule}`
  }));

  const notes = scopeByProfile(data.notes, profileId).map((item) => ({
    id: item.id,
    profileId: item.profileId,
    type: "note",
    title: item.title,
    description: item.content,
    createdAt: item.createdAt,
    meta: item.moodTag || "Nota libre"
  }));

  return [...bodyEntries, ...symptoms, ...appointments, ...checkups, ...treatments, ...notes].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}
