import { apiBase, catalogRequest } from './catalog.js';

export const realSessionEnabled = window.IdelConfig?.realSession === true;
const mockManagerNames = ['Светлана Юрьевна Павлова', 'Дмитрий Алексеевич Кузнецов', 'Анна Викторовна Попова', 'Максим Игоревич Соколов', 'Ольга Николаевна Морозова', 'Артём Павлович Волков', 'Мария Денисовна Васильева', 'Кирилл Евгеньевич Новиков', 'Наталья Олеговна Фёдорова', 'Илья Романович Михайлов', 'Андрей Владимирович Орлов', 'Виктория Сергеевна Белова', 'Александр Сергеевич Иванов'];
const mockManagers = mockManagerNames.map((name, index) => ({ id: `mock-manager-${index + 1}`, name }));
// Preview data lives only in memory, and never supplies a real authentication token.
const mockClients = new Map();

export function normalizeSessionPhone(phone) {
  const digits = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  if (!/^[78]\d{10}$/.test(digits)) throw new Error('Введите корректный номер телефона: +7 и 10 цифр.');
  return `+7${digits.slice(1)}`;
}

export function parseSessionName(value) {
  const words = typeof value === 'string' ? value.trim().split(/\s+/) : [];
  if (words.length < 2 || value.length > 200 || words.some(word => !/^\p{L}+(?:[-‐‑]\p{L}+)*$/u.test(word))) {
    throw new Error('Укажите фамилию и имя через пробел. Отчество необязательно; допустимы буквы и дефис.');
  }
  return { lastName: words[0], firstName: words[1], ...(words.length > 2 ? { middleName: words.slice(2).join(' ') } : {}) };
}

export function sessionConsentUrl() {
  const value = window.IdelConfig?.consentUrl;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function assertSessionTransport() {
  if (apiBase.protocol !== 'https:' && !(apiBase.protocol === 'http:' && window.IdelConfig?.allowHttpSession === true)) throw new Error('Для входа через API нужен HTTPS. Проверьте IdelConfig.apiBaseUrl.');
}

function aborted(signal) {
  if (signal?.aborted) throw new DOMException('Запрос отменён.', 'AbortError');
}

async function sessionRequest(path, { signal, body } = {}) {
  assertSessionTransport();
  aborted(signal);
  const response = await fetch(new URL(path, apiBase), {
    signal, method: body ? 'POST' : 'GET', credentials: 'omit',
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Сервер вернул некорректный ответ. Попробуйте ещё раз.'); }
  aborted(signal);
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Не удалось выполнить запрос (${response.status}).`);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

function sessionItem(data, mode) {
  const item = data?.item;
  if (!item || !/^[a-f0-9]{64}$/i.test(item.token || '') || item.mode !== mode || typeof item.expiresAt !== 'string' || !Number.isFinite(Date.parse(item.expiresAt))) {
    throw new Error('Сервер не вернул корректную сессию. Попробуйте ещё раз.');
  }
  if (mode === 'manager' && ![item.client, item.manager].every(value => Number.isSafeInteger(value?.id) && value.id > 0 && typeof value.name === 'string' && value.name.trim())) {
    throw new Error('Сервер не вернул данные клиента и менеджера. Попробуйте ещё раз.');
  }
  return { ...item, mock: false };
}

export async function loadSessionManagers({ signal } = {}) {
  aborted(signal);
  if (!realSessionEnabled) return mockManagers.map(manager => ({ ...manager }));
  assertSessionTransport();
  const data = await catalogRequest('managers', { signal });
  if (!Array.isArray(data?.items)) throw new Error('Некорректный ответ списка менеджеров.');
  return data.items.filter(item => Number.isSafeInteger(item.id) && item.id > 0 && typeof item.name === 'string' && item.name.trim());
}

export async function createPresentationSession({ mode, phone }, { signal } = {}) {
  if (!['guest', 'manager'].includes(mode)) throw new Error('Некорректный режим сессии.');
  const body = mode === 'guest' ? { mode } : { mode, phone: normalizeSessionPhone(phone) };
  aborted(signal);
  if (!realSessionEnabled) {
    if (mode === 'guest') return { mode, mock: true, client: null, manager: null };
    const saved = mockClients.get(body.phone);
    return saved ? { mode, mock: true, client: { ...saved.client }, manager: { ...saved.manager } } : { registrationRequired: true, phone: body.phone, mock: true };
  }
  const data = await sessionRequest('session', { signal, body });
  if (mode === 'manager' && data?.registrationRequired === true && !data.item) {
    if (normalizeSessionPhone(data.phone) !== body.phone) throw new Error('Сервер вернул другой номер телефона. Повторите вход.');
    return { registrationRequired: true, phone: body.phone, mock: false };
  }
  return sessionItem(data, mode);
}

export async function registerPresentationSession({ phone, lastName, firstName, middleName, managerId, consent }, { signal } = {}) {
  const names = [lastName, firstName, middleName].filter(value => value !== undefined);
  if (typeof lastName !== 'string' || typeof firstName !== 'string' || (middleName !== undefined && typeof middleName !== 'string')) throw new Error('Укажите фамилию и имя.');
  const parsed = parseSessionName(names.join(' '));
  // Joining must not turn a missing first name into an accepted name.
  if (parsed.lastName !== lastName || parsed.firstName !== firstName || (parsed.middleName || '') !== (middleName || '')) throw new Error('Проверьте фамилию, имя и отчество.');
  if (consent !== true) throw new Error('Для регистрации необходимо согласие на обработку персональных данных.');
  if (realSessionEnabled ? !Number.isSafeInteger(managerId) || managerId <= 0 : !mockManagers.some(manager => manager.id === managerId)) throw new Error('Выберите менеджера из списка.');
  const body = { phone: normalizeSessionPhone(phone), ...parsed, managerId, consent: true };
  aborted(signal);
  if (!realSessionEnabled) {
    if (mockClients.has(body.phone)) {
      const error = new Error('Клиент уже зарегистрирован.');
      error.status = 409; error.code = 'client_exists'; throw error;
    }
    const saved = { client: { id: `mock-client-${mockClients.size + 1}`, name: names.join(' ') }, manager: { ...mockManagers.find(manager => manager.id === managerId) } };
    mockClients.set(body.phone, saved);
    return { mode: 'manager', mock: true, client: { ...saved.client }, manager: { ...saved.manager } };
  }
  return sessionItem(await sessionRequest('session/register', { signal, body }), 'manager');
}
