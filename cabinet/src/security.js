import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);

export const id = () => randomUUID();
export const now = () => new Date().toISOString();

// Пароли: scrypt с солью, формат scrypt$соль$хэш (base64url).
export async function hashPassword(password) {
 const salt = randomBytes(16);
 const hash = await scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 });
 return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
export async function verifyPassword(password, stored) {
 const [scheme, salt, expected] = String(stored).split('$');
 if (scheme !== 'scrypt' || !salt || !expected) return false;
 const hash = await scrypt(password, Buffer.from(salt, 'base64url'), 32, { N: 16384, r: 8, p: 1 });
 const want = Buffer.from(expected, 'base64url');
 return want.length === hash.length && timingSafeEqual(want, hash);
}
// Для неудачных входов по несуществующему номеру, чтобы время ответа не выдавало, есть ли аккаунт.
export const dummyHash = await hashPassword(randomBytes(12).toString('hex'));

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const temporaryPassword = () => {
 const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
 return [...randomBytes(10)].map(b => alphabet[b % alphabet.length]).join('');
};

// Телефон Казахстана: приводим 8 707..., +7 (707)... и 707... к +77071234567.
export function normalizePhone(input) {
 let digits = String(input || '').replace(/\D/g, '');
 if (digits.length === 10) digits = '7' + digits;
 if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
 return /^7[67]\d{9}$/.test(digits) ? '+' + digits : null;
}
export const formatPhone = phone => phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2 $3 $4');

// БИН/ИИН: 12 цифр с контрольным разрядом по алгоритму, установленному в РК.
export function validBin(value) {
 if (!/^\d{12}$/.test(value)) return false;
 const d = [...value].map(Number);
 const sum = weights => weights.reduce((s, w, i) => s + w * d[i], 0) % 11;
 let control = sum([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
 if (control === 10) control = sum([3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]);
 return control !== 10 && control === d[11];
}

// Ограничение частоты попыток в памяти процесса: ключ → отметки времени.
export function rateLimiter({ limit, windowMs }) {
 const hits = new Map();
 return {
  hit(key, time = Date.now()) {
   const list = (hits.get(key) || []).filter(t => time - t < windowMs);
   list.push(time); hits.set(key, list);
   if (hits.size > 50000) for (const [k, v] of hits) if (time - v[v.length - 1] >= windowMs) hits.delete(k);
   return list.length <= limit;
  },
  reset(key) { hits.delete(key); }
 };
}

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
