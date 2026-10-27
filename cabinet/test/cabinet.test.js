import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { createCabinet } from '../src/app.js';
import { hashPassword, validBin, normalizePhone, id, now } from '../src/security.js';

// Все сценарии идут на SQLite в памяти; если задан CABINET_TEST_PG (postgres://...), повторяются на PostgreSQL.
const backends = [['sqlite', 'sqlite::memory:']];
if (process.env.CABINET_TEST_PG) backends.push(['postgres', process.env.CABINET_TEST_PG]);
const ORIGIN = 'http://localhost';
const BIN = '130640018278';

async function start(t, spec) {
 const db = await openDatabase(spec);
 if (db.kind === 'postgres') for (const table of ['updates', 'processes', 'offer_requests', 'companies', 'sessions', 'users']) await db.run(`DELETE FROM ${table}`);
 const server = createCabinet({ db, env: { COOKIE_SECURE: 'false', CABINET_ORIGIN: ORIGIN } });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
 const base = `http://127.0.0.1:${server.address().port}`;
 // Браузер с cookie: хранит сессию и CSRF-токен последней открытой страницы.
 const browser = () => {
  const jar = new Map(); let csrf = '';
  const remember = res => { for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); const [k, v] = pair.split('='); if (v) jar.set(k, v); else jar.delete(k); } };
  const headers = () => ({ cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') });
  const self = {
   async get(path) { const res = await fetch(base + path, { headers: headers(), redirect: 'manual' }); remember(res); const html = await res.text(); csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1] || csrf; return { status: res.status, location: res.headers.get('location'), html }; },
   async post(path, fields = {}, { withCsrf = true, origin = ORIGIN } = {}) {
    const res = await fetch(base + path, { method: 'POST', redirect: 'manual', headers: { ...headers(), 'content-type': 'application/x-www-form-urlencoded', origin }, body: new URLSearchParams(withCsrf && csrf ? { csrf, ...fields } : fields) });
    remember(res); return { status: res.status, location: res.headers.get('location'), html: await res.text(), cookies: res.headers.getSetCookie() };
   },
   async follow(path, fields, options) { const r = await self.post(path, fields, options); return r.location ? self.get(r.location) : r; }
  };
  return self;
 };
 return { db, browser };
}
async function registerClient(browser, phone = '+7 707 111 22 33', name = 'Арман') {
 const b = browser();
 const r = await b.post('/register', { name, phone, password: 'secret-pass-1', password2: 'secret-pass-1', consent: 'on' });
 assert.equal(r.status, 303); assert.equal(r.location, '/cabinet');
 await b.get('/cabinet');
 return b;
}
async function staffBrowser(db, browser, role = 'admin') {
 const phone = role === 'admin' ? '+77070000001' : '+77070000002';
 await db.run('INSERT INTO users (id, role, name, phone, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)', [id(), role, role === 'admin' ? 'Админ' : 'Менеджер', phone, await hashPassword('staff-pass-1'), now()]);
 const b = browser();
 const r = await b.post('/login', { phone, password: 'staff-pass-1' });
 assert.equal(r.location, '/admin');
 await b.get('/admin');
 return b;
}

test('BIN/IIN checksum and phone normalisation', () => {
 assert.ok(validBin(BIN));
 assert.ok(!validBin('130640018279'));
 assert.ok(!validBin('12345'));
 assert.equal(normalizePhone('8 (707) 111-22-33'), '+77071112233');
 assert.equal(normalizePhone('7071112233'), '+77071112233');
 assert.equal(normalizePhone('+1 202 555 0100'), null);
});

for (const [name, spec] of backends) {
 test(`${name}: registration validates input and lands on an empty pending cabinet`, async t => {
  const { browser } = await start(t, spec);
  const b = browser();
  for (const [fields, message] of [
   [{ name: 'А', phone: '+77071112233', password: 'secret-pass-1', password2: 'secret-pass-1', consent: 'on' }, /не короче 2/],
   [{ name: 'Арман', phone: '123', password: 'secret-pass-1', password2: 'secret-pass-1', consent: 'on' }, /казахстанский номер/],
   [{ name: 'Арман', phone: '+77071112233', password: 'short', password2: 'short', consent: 'on' }, /не короче 8/],
   [{ name: 'Арман', phone: '+77071112233', password: 'secret-pass-1', password2: 'other-pass-1', consent: 'on' }, /не совпадают/],
   [{ name: 'Арман', phone: '+77071112233', password: 'secret-pass-1', password2: 'secret-pass-1' }, /согласие/]
  ]) { const r = await b.post('/register', fields); assert.equal(r.status, 400); assert.match(r.html, message); }
  const client = await registerClient(browser);
  const home = await client.get('/cabinet');
  assert.match(home.html, /Кабинет пока пуст/);
  assert.doesNotMatch(home.html, /class="board"/);
  assert.match(home.html, /Платформа для вашей бухгалтерии/);
  const again = await browser().post('/register', { name: 'Арман', phone: '87071112233', password: 'secret-pass-1', password2: 'secret-pass-1', consent: 'on' });
  assert.match(again.html, /уже зарегистрирован/);
 });

 test(`${name}: full flow from BIN request to contract, processes and client feedback`, async t => {
  const { db, browser } = await start(t, spec);
  const client = await registerClient(browser);
  const bad = await client.follow('/cabinet/companies', { bin: '130640018279' });
  assert.match(bad.html, /Проверьте БИН или ИИН/);
  const ok = await client.follow('/cabinet/companies', { bin: BIN, name: 'ТОО «Тест»' });
  assert.match(ok.html, /Заявка на договор отправлена/);
  assert.match(ok.html, /Ожидают договора/);
  const company = await db.get('SELECT * FROM companies WHERE bin = ?', [BIN]);
  assert.equal(company.status, 'pending');
  assert.equal((await client.get(`/cabinet/c/${company.id}`)).status, 404, 'no access before the contract');
  assert.equal((await client.get('/admin')).location, '/cabinet', 'clients never reach the admin area');
  await client.follow('/cabinet/offer', { comment: 'Хотим автоматизировать склад' });
  assert.match((await client.get('/cabinet')).html, /Заявка принята/);

  const admin = await staffBrowser(db, browser);
  let page = await admin.get('/admin');
  assert.match(page.html, /ТОО «Тест»/); assert.match(page.html, /Хотим автоматизировать склад/);
  const wrongUrl = await admin.follow(`/admin/c/${company.id}/activate`, { name: 'ТОО «Тест»', contract_number: '15/26', contract_date: '2026-10-27', whatsapp_url: 'https://evil.example/x' });
  assert.match(wrongUrl.html, /chat\.whatsapp\.com/);
  page = await admin.follow(`/admin/c/${company.id}/activate`, { name: 'ТОО «Тест»', contract_number: '15/26', contract_date: '2026-10-27', whatsapp_url: 'https://chat.whatsapp.com/AbCdEfGhIjKlMn' });
  assert.match(page.html, /Доступ открыт/);
  page = await admin.follow(`/admin/c/${company.id}/processes`, { title: 'ФНО 910.00 за 2 полугодие', category: 'Отчётность', status: 'in_progress', period: '2 полугодие 2026', due_date: '2027-02-15', description: 'Готовим упрощённую декларацию' });
  assert.match(page.html, /Процесс добавлен/);
  const proc = await db.get('SELECT * FROM processes WHERE company_id = ?', [company.id]);
  await admin.get(`/admin/p/${proc.id}`);
  await admin.follow(`/admin/p/${proc.id}`, { status: 'waiting_client', due_date: '2027-02-15', body: 'Нужна выписка за декабрь' });

  const board = await client.get(`/cabinet/c/${company.id}`);
  assert.equal(board.status, 200);
  assert.match(board.html, /ФНО 910\.00 за 2 полугодие/); assert.match(board.html, /Ждём от вас/); assert.match(board.html, /chat\.whatsapp\.com\/AbCdEfGhIjKlMn/);
  const detail = await client.get(`/cabinet/p/${proc.id}`);
  assert.match(detail.html, /Нужна выписка за декабрь/); assert.match(detail.html, /Статус: Ждём от вас/);
  const fb = await client.follow(`/cabinet/p/${proc.id}/feedback`, { reaction: 'question', body: 'Выписку пришлём завтра' });
  assert.match(fb.html, /команда увидит/); assert.match(fb.html, /Выписку пришлём завтра/);

  page = await admin.get('/admin');
  assert.match(page.html, /Выписку пришлём завтра/); assert.match(page.html, /Есть вопрос/);
  await admin.get(`/admin/p/${proc.id}`);
  assert.doesNotMatch((await admin.get('/admin')).html, /Выписку пришлём завтра/, 'opening the process marks feedback as read');

  // Другой клиент не видит чужую компанию и процесс.
  const stranger = await registerClient(browser, '+7 707 999 88 77', 'Чужой');
  assert.equal((await stranger.get(`/cabinet/c/${company.id}`)).status, 404);
  assert.equal((await stranger.get(`/cabinet/p/${proc.id}`)).status, 404);
  assert.equal((await stranger.post(`/cabinet/p/${proc.id}/feedback`, { reaction: 'ok' })).status, 404);
 });

 test(`${name}: CSRF, origin, login limits and cookie flags`, async t => {
  const { db, browser } = await start(t, spec);
  const client = await registerClient(browser);
  assert.equal((await client.post('/cabinet/companies', { bin: BIN }, { withCsrf: false })).status, 403);
  assert.equal((await client.post('/cabinet/companies', { bin: BIN }, { origin: 'https://evil.example' })).status, 403);
  const anon = browser();
  const wrong = await anon.post('/login', { phone: '+77071112233', password: 'wrong-pass' });
  assert.equal(wrong.status, 401); assert.match(wrong.html, /Неверный телефон или пароль/);
  const right = await anon.post('/login', { phone: '8 707 111 22 33', password: 'secret-pass-1' });
  assert.equal(right.status, 303);
  assert.match(right.cookies.join(';'), /gb_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
  const flood = browser();
  let last;
  for (let i = 0; i < 11; i++) last = await flood.post('/login', { phone: '+77075550000', password: 'x' });
  assert.equal(last.status, 429);
  const sessions = await db.get('SELECT COUNT(*) AS n FROM sessions');
  assert.ok(Number(sessions.n) >= 2);
  const out = await client.post('/logout', {});
  assert.equal(out.location, '/login');
  assert.equal((await client.get('/cabinet')).location, '/login');
 });

 test(`${name}: temporary password forces a new password and closes old sessions`, async t => {
  const { db, browser } = await start(t, spec);
  const client = await registerClient(browser);
  const user = await db.get("SELECT id FROM users WHERE role = 'client'");
  const admin = await staffBrowser(db, browser);
  await admin.get('/admin/clients');
  const reset = await admin.post(`/admin/users/${user.id}/reset`, {});
  const temp = reset.html.match(/: ([A-Za-z0-9]{10})\. Передайте/)[1];
  assert.equal((await client.get('/cabinet')).location, '/login', 'old session is closed');
  const b = browser();
  assert.equal((await b.post('/login', { phone: '+77071112233', password: 'secret-pass-1' })).status, 401);
  const login = await b.post('/login', { phone: '+77071112233', password: temp });
  assert.equal(login.location, '/password');
  assert.equal((await b.get('/cabinet')).location, '/password');
  await b.get('/password');
  const changed = await b.post('/password', { current: temp, password: 'brand-new-pass', password2: 'brand-new-pass' });
  assert.equal(changed.location, '/cabinet');
  // Сотрудник без роли администратора не видит раздел сотрудников.
  const manager = await staffBrowser(db, browser, 'staff');
  assert.equal((await manager.get('/admin/staff')).status, 404);
  const created = await admin.get('/admin/staff');
  assert.equal(created.status, 200);
  const staff = await admin.post('/admin/staff', { name: 'Новый Сотрудник', phone: '+7 707 333 44 55', role: 'staff' });
  assert.match(staff.html, /Временный пароль: [A-Za-z0-9]{10}/);
 });
}
