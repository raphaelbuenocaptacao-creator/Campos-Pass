(() => {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure || !('serviceWorker' in navigator)) return;

  let registrationRef = null;
  let deferredInstallPrompt = null;

  async function refreshServiceWorker() {
    if (!registrationRef) return;
    try {
      await registrationRef.update();
    } catch (_) {}
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    window.dispatchEvent(new CustomEvent('campospass:install-available'));
  });

  window.addEventListener('campospass:install', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } finally {
      deferredInstallPrompt = null;
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
  });

  window.addEventListener('load', async () => {
    try {
      registrationRef = await navigator.serviceWorker.register('./sw.js?v=9-private-vary-star-safe', {
        scope: './',
        updateViaCache: 'none'
      });
      await refreshServiceWorker();
    } catch (error) {
      console.warn('[Campos Pass] Service worker não registrado:', error);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshServiceWorker();
  });

  window.addEventListener('online', refreshServiceWorker);
})();
