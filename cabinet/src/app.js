import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { id, now, hashPassword, verifyPassword, dummyHash, newToken, tokenHash, temporaryPassword, normalizePhone, formatPhone, validBin, rateLimiter } from './security.js';
import { STATUSES, CATEGORIES, REACTIONS, CONSENT_VERSION } from './constants.js';
import * as view from './views.js';

const SESSION_DAYS = 30;
const STATUS_KEYS = STATUSES.map(([k]) => k);
const REACTION_KEYS = REACTIONS.map(([k]) => k);
const assetsDir = new URL('../public/', import.meta.url);
const siteDir = new URL('../../public/', import.meta.url);
const ASSETS = {
 'cabinet.css': [assetsDir, 'text/css; charset=utf-8'],
 'cabinet.js': [assetsDir, 'text/javascript; charset=utf-8'],
 'logo-gb.png': [siteDir, 'image/png'],
 'favicon.ico': [siteDir, 'image/x-icon']
};
const FONT = /^fonts\/(golos-text-(cyrillic|latin)-(400|500|600)-normal|geologica-(cyrillic|latin|latin-ext)|martian-mono-(cyrillic|latin))\.woff2$/;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const validDate = value => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));

export function createCabinet({ db, env = process.env, clock = () => Date.now() } = {}) {
 const secureCookie = env.COOKIE_SECURE !== 'false';
 const allowedOrigins = new Set(String(env.CABINET_ORIGIN || 'https://cabinet.glav-buh.kz').split(',').map(s => s.trim()).filter(Boolean));
 const loginLimit = rateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
 const registerLimit = rateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });
 const writeLimit = rateLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });

 const send = (res, status, body, type = 'text/html; charset=utf-8', headers = {}) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers }); res.end(body); };
 // Несколько Set-Cookie в одном ответе: накапливаем, а не перезаписываем.
 const addCookie = (res, value) => { const current = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', [...(Array.isArray(current) ? current : current ? [current] : []), value]); };
 const redirect = (res, location, cookies = []) => { cookies.forEach(c => addCookie(res, c)); res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' }); res.end(); };
 const cookie = (token, maxAge) => `gb_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
 // Короткое сообщение после действия, живёт до следующего показа страницы.
 const flashCookie = (type, message) => `gb_flash=${encodeURIComponent(JSON.stringify({ type, text: message }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=60${secureCookie ? '; Secure' : ''}`;
 const readCookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(p => p.trim().split('=')).filter(([k, v]) => k && v !== undefined).map(([k, ...v]) => [k, v.join('=')]));

 async function body(req) {
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Ожидается отправка формы.');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new HttpError(413, 'Слишком большой запрос.'); chunks.push(chunk); }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
 }

 async function sessionFor(req) {
  const token = readCookies(req).gb_session;
  if (!token || token.length > 100) return null;
  const row = await db.get(`SELECT s.token_hash, s.csrf, s.expires_at, u.id, u.role, u.name, u.phone, u.must_change_password, u.disabled FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`, [tokenHash(token)]);
  if (!row || row.disabled || Date.parse(row.expires_at) < clock()) return null;
  return row;
 }
 async function startSession(res, user, location) {
  const token = newToken(), created = new Date(clock());
  // Заодно убираем истёкшие сессии: строки ISO сравниваются как время.
  await db.run('DELETE FROM sessions WHERE expires_at < ?', [created.toISOString()]);
  await db.run('INSERT INTO sessions (token_hash, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [tokenHash(token), user.id, newToken(), created.toISOString(), new Date(clock() + SESSION_DAYS * 864e5).toISOString()]);
  await db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [created.toISOString(), user.id]);
  redirect(res, location, [cookie(token, SESSION_DAYS * 86400)]);
 }
 const home = user => user.must_change_password ? '/password' : user.role === 'client' ? '/cabinet' : '/admin';

 // Компания клиента: только своя и только с открытым доступом.
 async function clientCompany(user, companyId) {
  const company = await db.get("SELECT * FROM companies WHERE id = ? AND owner_id = ? AND status = 'active'", [companyId, user.id]);
  if (!company) throw new HttpError(404, 'Компания не найдена.');
  return company;
 }
 async function clientProcess(user, processId) {
  const process = await db.get("SELECT p.* FROM processes p JOIN companies c ON c.id = p.company_id WHERE p.id = ? AND c.owner_id = ? AND c.status = 'active'", [processId, user.id]);
  if (!process) throw new HttpError(404, 'Процесс не найден.');
  return { process, company: await clientCompany(user, process.company_id) };
 }
 const updatesFor = processId => db.all('SELECT u.*, a.name AS author_name, a.role AS author_role FROM updates u LEFT JOIN users a ON a.id = u.author_id WHERE u.process_id = ? ORDER BY u.created_at DESC', [processId]);

 async function handle(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (secureCookie) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname, method = req.method;

  if (path === '/healthz') return send(res, 200, JSON.stringify({ status: 'ok', db: db.kind }), 'application/json');
  if (path.startsWith('/assets/') && (method === 'GET' || method === 'HEAD')) {
   const name = path.slice('/assets/'.length);
   const entry = ASSETS[name] || (FONT.test(name) ? [siteDir, 'font/woff2'] : null);
   if (!entry) throw new HttpError(404, 'Не найдено.');
   const data = await readFile(new URL(name, entry[0]));
   res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'public, max-age=3600' });
   return res.end(method === 'HEAD' ? undefined : data);
  }

  const user = await sessionFor(req);
  const cookies = readCookies(req);
  let message = null;
  if (cookies.gb_flash) { try { message = JSON.parse(decodeURIComponent(cookies.gb_flash)); } catch {} addCookie(res, 'gb_flash=; Path=/; Max-Age=0'); }
  const ctx = { user, csrf: user?.csrf };

  let form = {};
  if (method === 'POST') {
   const origin = req.headers.origin;
   if (origin && !allowedOrigins.has(origin)) throw new HttpError(403, 'Недопустимый источник запроса.');
   form = await body(req);
   if (user && form.csrf !== user.csrf) throw new HttpError(403, 'Сессия устарела. Обновите страницу и повторите.');
   if (user && !writeLimit.hit(user.id)) throw new HttpError(429, 'Слишком много действий. Попробуйте через несколько минут.');
  } else if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Метод не поддерживается.');

  const ip = req.socket.remoteAddress || 'unknown';
  const back = (location, type, msg) => redirect(res, location, [flashCookie(type, msg)]);

  /* ----- публичная часть ----- */
  if (path === '/') return redirect(res, user ? home(user) : '/login');
  if (path === '/login') {
   if (method === 'GET') return user ? redirect(res, home(user)) : send(res, 200, view.loginPage({ notice: message }));
   const phone = normalizePhone(form.phone);
   if (!loginLimit.hit(`ip:${ip}`) || (phone && !loginLimit.hit(`phone:${phone}`))) return send(res, 429, view.loginPage({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.', phone: form.phone }));
   const account = phone ? await db.get('SELECT * FROM users WHERE phone = ?', [phone]) : null;
   const ok = await verifyPassword(String(form.password || ''), account?.password_hash || dummyHash);
   if (!account || !ok || account.disabled) return send(res, 401, view.loginPage({ error: 'Неверный телефон или пароль.', phone: form.phone }));
   loginLimit.reset(`phone:${phone}`);
   return startSession(res, account, home(account));
  }
  if (path === '/register') {
   if (method === 'GET') return user ? redirect(res, home(user)) : send(res, 200, view.registerPage({}));
   const values = { name: text(form.name, 80), phone: text(form.phone, 30), consent: form.consent === 'on', marketing: form.marketing === 'on' };
   const fail = error => send(res, 400, view.registerPage({ error, values }));
   const phone = normalizePhone(values.phone);
   if (values.name.length < 2 || /[\x00-\x1f<>]/.test(values.name)) return fail('Укажите имя, не короче 2 символов.');
   if (!phone) return fail('Укажите казахстанский номер телефона, например +7 707 123 45 67.');
   if (String(form.password || '').length < 8 || String(form.password).length > 200) return fail('Пароль должен быть не короче 8 символов.');
   if (form.password !== form.password2) return fail('Пароли не совпадают.');
   if (!values.consent) return fail('Для регистрации нужно согласие на обработку персональных данных.');
   // Лимит считает только заполненные без ошибок формы: опечатки не блокируют регистрацию.
   if (!registerLimit.hit(`ip:${ip}`)) return send(res, 429, view.registerPage({ error: 'Слишком много регистраций с этого адреса. Попробуйте позже.', values }));
   if (await db.get('SELECT id FROM users WHERE phone = ?', [phone])) return fail('Этот номер уже зарегистрирован. Войдите или запросите временный пароль у менеджера.');
   const account = { id: id(), role: 'client' };
   await db.run('INSERT INTO users (id, role, name, phone, password_hash, consent_at, consent_version, marketing, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [account.id, 'client', values.name, phone, await hashPassword(form.password), now(), CONSENT_VERSION, values.marketing ? 1 : 0, now()]);
   return startSession(res, account, '/cabinet');
  }

  if (!user) return method === 'GET' ? redirect(res, '/login') : send(res, 401, view.loginPage({ error: 'Войдите, чтобы продолжить.' }));
  if (path === '/logout' && method === 'POST') {
   await db.run('DELETE FROM sessions WHERE token_hash = ?', [user.token_hash]);
   return redirect(res, '/login', [cookie('', 0)]);
  }
  if (path === '/password') {
   const forced = Boolean(user.must_change_password);
   if (method === 'GET') return send(res, 200, view.passwordPage({ ...ctx, forced }));
   const account = await db.get('SELECT password_hash FROM users WHERE id = ?', [user.id]);
   const fail = error => send(res, 400, view.passwordPage({ ...ctx, forced, error }));
   if (!(await verifyPassword(String(form.current || ''), account.password_hash))) return fail('Текущий пароль указан неверно.');
   if (String(form.password || '').length < 8 || String(form.password).length > 200) return fail('Новый пароль должен быть не короче 8 символов.');
   if (form.password !== form.password2) return fail('Пароли не совпадают.');
   if (form.password === form.current) return fail('Новый пароль должен отличаться от текущего.');
   await db.run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [await hashPassword(form.password), user.id]);
   // Остальные сессии этого пользователя закрываем.
   await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [user.id, user.token_hash]);
   return back(user.role === 'client' ? '/cabinet' : '/admin', 'ok', 'Пароль сохранён.');
  }
  if (user.must_change_password) return redirect(res, '/password');

  /* ----- кабинет клиента ----- */
  if (path.startsWith('/cabinet')) {
   if (user.role !== 'client') return redirect(res, '/admin');
   if (path === '/cabinet' && method === 'GET') {
    const companies = await db.all(`SELECT c.*,
      (SELECT COUNT(*) FROM processes p WHERE p.company_id = c.id AND p.status IN ('planned','in_progress')) AS open,
      (SELECT COUNT(*) FROM processes p WHERE p.company_id = c.id AND p.status = 'waiting_client') AS waiting,
      (SELECT COUNT(*) FROM processes p WHERE p.company_id = c.id AND p.status = 'done') AS done
      FROM companies c WHERE c.owner_id = ? AND c.status <> 'archived' ORDER BY c.requested_at`, [user.id]);
    const offer = await db.get('SELECT id FROM offer_requests WHERE user_id = ?', [user.id]);
    return send(res, 200, view.clientHome({ ...ctx, companies: companies.map(c => ({ ...c, open: Number(c.open), waiting: Number(c.waiting), done: Number(c.done) })), offerRequested: Boolean(offer), message }));
   }
   if (path === '/cabinet/companies' && method === 'POST') {
    const bin = String(form.bin || '').replace(/\s/g, '');
    if (!validBin(bin)) return back('/cabinet', 'error', 'Проверьте БИН или ИИН: нужно 12 цифр без ошибок в контрольном разряде.');
    if (await db.get('SELECT id FROM companies WHERE owner_id = ? AND bin = ?', [user.id, bin])) return back('/cabinet', 'error', 'Эта компания уже добавлена.');
    const count = await db.get('SELECT COUNT(*) AS n FROM companies WHERE owner_id = ?', [user.id]);
    if (Number(count.n) >= 20) return back('/cabinet', 'error', 'Добавлено слишком много компаний. Свяжитесь с менеджером.');
    await db.run("INSERT INTO companies (id, owner_id, bin, name, status, requested_at) VALUES (?, ?, ?, ?, 'pending', ?)", [id(), user.id, bin, text(form.name, 120), now()]);
    return back('/cabinet', 'ok', 'Заявка на договор отправлена. Менеджер свяжется с вами.');
   }
   if (path === '/cabinet/offer' && method === 'POST') {
    if (!(await db.get('SELECT id FROM offer_requests WHERE user_id = ?', [user.id]))) await db.run('INSERT INTO offer_requests (id, user_id, comment, created_at) VALUES (?, ?, ?, ?)', [id(), user.id, text(form.comment, 1000), now()]);
    return back('/cabinet', 'ok', 'Спасибо! Расскажем о платформе.');
   }
   let match = path.match(/^\/cabinet\/c\/([\w-]{36})$/);
   if (match && method === 'GET') {
    const company = await clientCompany(user, match[1]);
    const processes = await db.all(`SELECT p.*,
      (SELECT body FROM updates u WHERE u.process_id = p.id AND u.kind = 'staff_note' ORDER BY u.created_at DESC LIMIT 1) AS last_note,
      (SELECT COUNT(*) FROM updates u WHERE u.process_id = p.id AND u.kind = 'client_feedback') AS feedback
      FROM processes p WHERE p.company_id = ? ORDER BY p.updated_at DESC`, [company.id]);
    return send(res, 200, view.companyBoard({ ...ctx, company, processes: processes.map(p => ({ ...p, feedback: Number(p.feedback) })), message }));
   }
   match = path.match(/^\/cabinet\/p\/([\w-]{36})$/);
   if (match && method === 'GET') {
    const { process, company } = await clientProcess(user, match[1]);
    return send(res, 200, view.clientProcess({ ...ctx, company, process, updates: await updatesFor(process.id), message }));
   }
   match = path.match(/^\/cabinet\/p\/([\w-]{36})\/feedback$/);
   if (match && method === 'POST') {
    const { process } = await clientProcess(user, match[1]);
    const reaction = REACTION_KEYS.includes(form.reaction) ? form.reaction : 'ok';
    await db.run("INSERT INTO updates (id, process_id, author_id, kind, body, reaction, read_by_staff, created_at) VALUES (?, ?, ?, 'client_feedback', ?, ?, 0, ?)", [id(), process.id, user.id, text(form.body, 2000), reaction, now()]);
    return back(`/cabinet/p/${process.id}`, 'ok', 'Спасибо, команда увидит ваш отзыв.');
   }
   throw new HttpError(404, 'Страница не найдена.');
  }

  /* ----- админка ----- */
  if (path.startsWith('/admin')) {
   if (user.role === 'client') return redirect(res, '/cabinet');
   if (path === '/admin' && method === 'GET') {
    const pending = await db.all("SELECT c.*, u.name AS owner_name, u.phone AS owner_phone FROM companies c JOIN users u ON u.id = c.owner_id WHERE c.status = 'pending' ORDER BY c.requested_at");
    const feedback = await db.all("SELECT u.*, p.title AS process_title, c.name AS company_name, c.bin, a.name AS author_name FROM updates u JOIN processes p ON p.id = u.process_id JOIN companies c ON c.id = p.company_id JOIN users a ON a.id = u.author_id WHERE u.kind = 'client_feedback' AND u.read_by_staff = 0 ORDER BY u.created_at DESC LIMIT 100");
    const offers = await db.all('SELECT o.*, u.name, u.phone FROM offer_requests o JOIN users u ON u.id = o.user_id WHERE o.handled = 0 ORDER BY o.created_at');
    return send(res, 200, view.adminHome({ ...ctx, pending, feedback, offers, message }));
   }
   if (path === '/admin/clients' && method === 'GET') {
    const q = text(url.searchParams.get('q'), 60);
    const like = `%${q.toLowerCase()}%`, digits = q.replace(/\D/g, '');
    const users = await db.all(`SELECT DISTINCT u.id, u.name, u.phone, u.marketing, u.created_at FROM users u LEFT JOIN companies c ON c.owner_id = u.id
      WHERE u.role = 'client' AND (? = '' OR LOWER(u.name) LIKE ? OR LOWER(c.name) LIKE ? OR (? <> '' AND (u.phone LIKE ? OR c.bin LIKE ?)))
      ORDER BY u.created_at DESC LIMIT 200`, [q, like, like, digits, `%${digits}%`, `%${digits}%`]);
    const companies = users.length ? await db.all(`SELECT id, owner_id, bin, name, status FROM companies WHERE owner_id IN (${users.map(() => '?').join(',')})`, users.map(u => u.id)) : [];
    return send(res, 200, view.adminClients({ ...ctx, q, rows: users.map(u => ({ ...u, companies: companies.filter(c => c.owner_id === u.id) })) }));
   }
   let match = path.match(/^\/admin\/c\/([\w-]{36})(?:\/(activate|settings|processes))?$/);
   if (match) {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [match[1]]);
    if (!company) throw new HttpError(404, 'Компания не найдена.');
    const here = `/admin/c/${company.id}`;
    if (!match[2] && method === 'GET') {
     const owner = await db.get('SELECT name, phone FROM users WHERE id = ?', [company.owner_id]);
     const processes = await db.all(`SELECT p.*,
       (SELECT COUNT(*) FROM updates u WHERE u.process_id = p.id AND u.kind = 'client_feedback') AS feedback,
       (SELECT COUNT(*) FROM updates u WHERE u.process_id = p.id AND u.kind = 'client_feedback' AND u.read_by_staff = 0) AS unread
       FROM processes p WHERE p.company_id = ? ORDER BY p.updated_at DESC`, [company.id]);
     return send(res, 200, view.adminCompany({ ...ctx, company, owner, processes: processes.map(p => ({ ...p, feedback: Number(p.feedback), unread: Number(p.unread) })), message }));
    }
    if ((match[2] === 'activate' || match[2] === 'settings') && method === 'POST') {
     const fields = { name: text(form.name, 120), contract_number: text(form.contract_number, 40), contract_date: text(form.contract_date, 10), whatsapp_url: text(form.whatsapp_url, 200) };
     if (!fields.name || !fields.contract_number || !fields.contract_date || !validDate(fields.contract_date)) return back(here, 'error', 'Укажите название, номер и дату договора.');
     if (fields.whatsapp_url && !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/.test(fields.whatsapp_url)) return back(here, 'error', 'Ссылка на группу должна выглядеть так: https://chat.whatsapp.com/…');
     if (match[2] === 'activate') {
      if (company.status !== 'pending') return back(here, 'error', 'Доступ уже открыт.');
      await db.run("UPDATE companies SET name = ?, contract_number = ?, contract_date = ?, whatsapp_url = ?, status = 'active', activated_at = ?, activated_by = ? WHERE id = ?", [fields.name, fields.contract_number, fields.contract_date, fields.whatsapp_url, now(), user.id, company.id]);
      return back(here, 'ok', 'Доступ открыт. Клиент видит компанию в кабинете.');
     }
     await db.run('UPDATE companies SET name = ?, contract_number = ?, contract_date = ?, whatsapp_url = ? WHERE id = ?', [fields.name, fields.contract_number, fields.contract_date, fields.whatsapp_url, company.id]);
     return back(here, 'ok', 'Сохранено.');
    }
    if (match[2] === 'processes' && method === 'POST') {
     if (company.status !== 'active') return back(here, 'error', 'Сначала откройте доступ по договору.');
     const p = { title: text(form.title, 140), category: CATEGORIES.includes(form.category) ? form.category : 'Другое', status: STATUS_KEYS.includes(form.status) ? form.status : 'planned', period: text(form.period, 40), due_date: text(form.due_date, 10), description: text(form.description, 2000) };
     if (p.title.length < 2) return back(here, 'error', 'Укажите название процесса.');
     if (!validDate(p.due_date)) return back(here, 'error', 'Проверьте срок.');
     const pid = id(), time = now();
     await db.run('INSERT INTO processes (id, company_id, title, category, status, period, due_date, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [pid, company.id, p.title, p.category, p.status, p.period, p.due_date, p.description, user.id, time, time]);
     await db.run("INSERT INTO updates (id, process_id, author_id, kind, body, created_at) VALUES (?, ?, ?, 'status_change', ?, ?)", [id(), pid, user.id, `Процесс создан: ${STATUSES.find(([k]) => k === p.status)[1]}`, time]);
     return back(here, 'ok', 'Процесс добавлен, клиент его видит.');
    }
   }
   match = path.match(/^\/admin\/p\/([\w-]{36})$/);
   if (match) {
    const process = await db.get('SELECT * FROM processes WHERE id = ?', [match[1]]);
    if (!process) throw new HttpError(404, 'Процесс не найден.');
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [process.company_id]);
    if (method === 'GET') {
     // Открыв процесс, сотрудник прочитал отзывы клиента.
     await db.run("UPDATE updates SET read_by_staff = 1 WHERE process_id = ? AND kind = 'client_feedback'", [process.id]);
     return send(res, 200, view.adminProcess({ ...ctx, company, process, updates: await updatesFor(process.id), message }));
    }
    const status = STATUS_KEYS.includes(form.status) ? form.status : process.status;
    const due = text(form.due_date, 10), note = text(form.body, 2000);
    if (!validDate(due)) return back(`/admin/p/${process.id}`, 'error', 'Проверьте срок.');
    const time = now();
    await db.transaction(async tx => {
     await tx.run('UPDATE processes SET status = ?, due_date = ?, updated_at = ? WHERE id = ?', [status, due, time, process.id]);
     if (status !== process.status) await tx.run("INSERT INTO updates (id, process_id, author_id, kind, body, created_at) VALUES (?, ?, ?, 'status_change', ?, ?)", [id(), process.id, user.id, `Статус: ${STATUSES.find(([k]) => k === status)[1]}`, time]);
     if (note) await tx.run("INSERT INTO updates (id, process_id, author_id, kind, body, created_at) VALUES (?, ?, ?, 'staff_note', ?, ?)", [id(), process.id, user.id, note, time]);
    });
    return back(`/admin/p/${process.id}`, 'ok', 'Сохранено, клиент видит обновление.');
   }
   match = path.match(/^\/admin\/offers\/([\w-]{36})\/handled$/);
   if (match && method === 'POST') {
    await db.run('UPDATE offer_requests SET handled = 1 WHERE id = ?', [match[1]]);
    return back('/admin', 'ok', 'Заявка отмечена обработанной.');
   }
   match = path.match(/^\/admin\/users\/([\w-]{36})\/reset$/);
   if (match && method === 'POST') {
    const target = await db.get('SELECT id, role, name, phone FROM users WHERE id = ?', [match[1]]);
    if (!target || (target.role !== 'client' && user.role !== 'admin')) throw new HttpError(404, 'Пользователь не найден.');
    const temp = temporaryPassword();
    await db.run('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [await hashPassword(temp), target.id]);
    await db.run('DELETE FROM sessions WHERE user_id = ?', [target.id]);
    return send(res, 200, view.messagePage({ ...ctx, title: 'Временный пароль', text: `${target.name}, ${formatPhone(target.phone)}: ${temp}. Передайте его клиенту лично или по телефону. При входе клиент задаст новый пароль. Пароль показан один раз.`, back: '/admin/clients' }));
   }
   if (path === '/admin/staff') {
    if (user.role !== 'admin') throw new HttpError(404, 'Страница не найдена.');
    if (method === 'GET') return send(res, 200, view.adminStaff({ ...ctx, staff: await db.all("SELECT id, name, phone, role, disabled, last_login_at FROM users WHERE role IN ('staff','admin') ORDER BY name"), message }));
    const phone = normalizePhone(form.phone), name = text(form.name, 80), role = form.role === 'admin' ? 'admin' : 'staff';
    if (!phone || name.length < 2) return back('/admin/staff', 'error', 'Укажите имя и казахстанский номер телефона.');
    if (await db.get('SELECT id FROM users WHERE phone = ?', [phone])) return back('/admin/staff', 'error', 'Этот номер уже зарегистрирован.');
    const temp = temporaryPassword();
    await db.run('INSERT INTO users (id, role, name, phone, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [id(), role, name, phone, await hashPassword(temp), now()]);
    return send(res, 200, view.messagePage({ ...ctx, title: 'Сотрудник создан', text: `${name}, ${formatPhone(phone)}. Временный пароль: ${temp}. При первом входе сотрудник задаст свой пароль. Пароль показан один раз.`, back: '/admin/staff' }));
   }
   throw new HttpError(404, 'Страница не найдена.');
  }
  throw new HttpError(404, 'Страница не найдена.');
 }

 return http.createServer(async (req, res) => {
  try { await handle(req, res); }
  catch (error) {
   const status = error instanceof HttpError ? error.status : 500;
   if (status === 500) console.error(error);
   if (!res.headersSent) send(res, status, view.messagePage({ title: status === 404 ? 'Не найдено' : 'Ошибка', text: status === 500 ? 'Временная ошибка. Попробуйте ещё раз.' : error.message, back: '/' }));
   else res.end();
  }
 });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
 const { openDatabase } = await import('./db.js');
 const db = await openDatabase();
 const server = createCabinet({ db });
 server.requestTimeout = 20000; server.headersTimeout = 15000;
 const port = Number(process.env.PORT || 3100);
 server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Кабинет ГлавБух: порт ${port}, база ${db.kind}`));
 for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await db.close(); process.exit(0); }));
}
