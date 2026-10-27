// Создаёт сотрудника или администратора кабинета. Первого администратора создают так:
//   node scripts/create-staff.js --name "Имя" --phone "+7 707 000 00 00" --role admin
// Пароль временный: он печатается один раз, при первом входе нужно задать свой.
import { parseArgs } from 'node:util';
import { openDatabase } from '../src/db.js';
import { id, now, hashPassword, normalizePhone, temporaryPassword, formatPhone } from '../src/security.js';

const { values } = parseArgs({ options: { name: { type: 'string' }, phone: { type: 'string' }, role: { type: 'string', default: 'staff' } } });
const phone = normalizePhone(values.phone);
const role = values.role === 'admin' ? 'admin' : 'staff';
if (!values.name || values.name.trim().length < 2 || !phone) {
 console.error('Укажите --name и --phone (казахстанский номер), например: --name "Айгерим" --phone "+7 707 000 00 00" --role admin');
 process.exit(1);
}
const db = await openDatabase();
if (await db.get('SELECT id FROM users WHERE phone = ?', [phone])) {
 console.error(`Номер ${formatPhone(phone)} уже зарегистрирован.`);
 await db.close(); process.exit(1);
}
const temp = temporaryPassword();
await db.run('INSERT INTO users (id, role, name, phone, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [id(), role, values.name.trim(), phone, await hashPassword(temp), now()]);
console.log(`${role === 'admin' ? 'Администратор' : 'Сотрудник'} создан: ${values.name.trim()}, ${formatPhone(phone)}`);
console.log(`Временный пароль: ${temp}`);
await db.close();
