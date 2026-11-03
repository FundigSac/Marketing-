/** Aviso del navegador (sin servidor) cuando la app genera algo nuevo y el permiso ya fue concedido. */
export async function localNotify(title: string, body: string, url = "/") {
  try {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg) await reg.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url } });
    else new Notification(title, { body, icon: "/icon-192.png" });
  } catch { /* sin permiso o sin service worker: se omite */ }
}
