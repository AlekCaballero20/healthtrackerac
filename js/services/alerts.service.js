export function toastMarkup(toast) {
  if (!toast) return "";

  return `
    <div class="toast ${toast.type || "success"}" role="status" aria-live="polite">
      <strong>${toast.title}</strong>
      <div>${toast.message}</div>
    </div>
  `;
}
