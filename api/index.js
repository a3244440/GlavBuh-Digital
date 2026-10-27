import { createApp } from '../src/server.js';

// Reuse application state within a warm Vercel function; do not open a port.
const app = createApp();
const requestHandler = app.listeners('request')[0];

// Кабинет клиента временно живёт по пути /cabinet на этом же домене. Открывается лениво, чтобы сайт не ждал базу.
let cabinet;
function cabinetHandler() {
  cabinet ??= (async () => {
    const { openDatabase, databaseSpec, isTemporary } = await import('../cabinet/src/db.js');
    const { createCabinet, bootstrapAdmin } = await import('../cabinet/src/app.js');
    const spec = databaseSpec(process.env);
    const db = await openDatabase(spec);
    await bootstrapAdmin(db, process.env);
    const origins = ['https://glavbuhdigital.vercel.app', process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
      .filter(Boolean).map(host => host.startsWith('https://') ? host : `https://${host}`);
    const env = { ...process.env, CABINET_BASE: '/cabinet', CABINET_ORIGIN: process.env.CABINET_ORIGIN || origins.join(','), CABINET_DEMO: isTemporary(spec) ? 'true' : process.env.CABINET_DEMO };
    return createCabinet({ db, env }).listeners('request')[0];
  })().catch(error => { cabinet = undefined; throw error; });
  return cabinet;
}

export default async function handler(req, res) {
  const path = (req.url || '/').split('?')[0];
  if (path === '/cabinet' || path.startsWith('/cabinet/')) {
    try { return (await cabinetHandler())(req, res); }
    catch (error) {
      console.error(error);
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('Кабинет временно недоступен.');
    }
  }
  return requestHandler(req, res);
}
