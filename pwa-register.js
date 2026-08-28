(() => {
  const secure = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  if (!secure || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('[Campos Pass] Service worker não registrado:', error);
    }
  });
})();
