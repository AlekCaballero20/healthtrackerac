/**
 * Exporta el estado actual de la app como un archivo JSON descargable.
 * Sirve como backup manual antes de cambios o para revisión offline.
 * @param {Object} data - El objeto data del estado de la app
 */
export function exportData(data) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `bienestar-backup-${timestamp}.json`;

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
