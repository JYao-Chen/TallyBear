// Retire Actual's old offline shell without touching local ledger databases.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('workbox-')).map(name => caches.delete(name)));
  await self.registration.unregister();
  const windows = await self.clients.matchAll({type: 'window'});
  await Promise.all(windows.map(client => client.navigate('/')));
})()));
