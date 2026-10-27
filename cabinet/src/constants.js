export const STATUSES = [
 ['planned', 'Запланировано'],
 ['in_progress', 'В работе'],
 ['waiting_client', 'Ждём от вас'],
 ['done', 'Готово']
];
export const statusLabel = key => (STATUSES.find(([k]) => k === key) || [, key])[1];

export const CATEGORIES = ['Отчётность', 'Налоги и платежи', 'Зарплата и кадры', 'Банк и выписки', 'Консультация', 'Другое'];

export const REACTIONS = [
 ['ok', 'Всё понятно'],
 ['question', 'Есть вопрос'],
 ['disagree', 'Не согласен']
];
export const reactionLabel = key => (REACTIONS.find(([k]) => k === key) || [, ''])[1];

export const COMPANY_STATUSES = { pending: 'Ожидает договора', active: 'Договор заключён', archived: 'В архиве' };

// Версия текста согласия на обработку персональных данных при регистрации.
export const CONSENT_VERSION = 'privacy-policy-2026-10-20';
export const SITE = 'https://glav-buh.kz';
