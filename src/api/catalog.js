import { throughDataGateway } from './dataGateway.js';
const configuredBase = window.IdelConfig?.apiBaseUrl || (location.protocol === 'file:' ? 'http://idel.yes-project.ru/api' : '/api');
export const apiBase = new URL(configuredBase.replace(/\/$/, '') + '/', location.href);

export async function catalogRequest(path, { signal, token, method = 'GET', body } = {}) {
  return throughDataGateway(path, { signal, token, method, body }, catalogRequestDirect);
}

export async function catalogRequestDirect(path, { signal, token, method = 'GET', body } = {}) {
  if (token && apiBase.protocol !== 'https:' && !(apiBase.protocol === 'http:' && window.IdelConfig?.allowHttpSession === true)) throw new Error('Authenticated API requires HTTPS');
  const response = await fetch(new URL(path, apiBase), {
    signal, method, credentials: 'omit', headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Ошибка загрузки (${response.status})`);
  return data;
}

export function mediaUrl(value, screenshot = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (screenshot && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value, apiBase);
    return ['http:', 'https:'].includes(url.protocol) || (screenshot && location.protocol === 'file:' && url.protocol === 'file:') ? url.href : null;
  } catch { return null; }
}

export const emptyApartmentFilters = () => ({ section: null, rooms: [], features: [], floorFrom: null, floorTo: null, areaFrom: null, areaTo: null, priceFrom: null, priceTo: null, number: '' });
export function propertyQuery(filters, page = 1) {
  const query = new URLSearchParams({ type: 'apartment', limit: '100', page: String(page) });
  // Include published reserved/sold units so Unreal can render the status legend.
  for (const status of ['available', 'reserved', 'sold']) query.append('status[]', status);
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) value.forEach(item => query.append(`${key}[]`, String(item)));
    else if (value !== null && value !== '') query.set(key, String(value));
  }
  return query.toString();
}

export async function loadProperties(filters, signal) {
  const result = [];
  for (let page = 1; ; page++) {
    const data = await catalogRequest(`properties?${propertyQuery(filters, page)}`, { signal });
    if (!Array.isArray(data.items) || !data.meta || typeof data.meta.hasNext !== 'boolean') throw new Error('Неверный ответ каталога');
    result.push(...data.items);
    if (!data.meta.hasNext) return result;
    if (!data.items.length || page >= data.meta.totalPages) throw new Error('Неверная пагинация каталога');
  }
}

export const numberText = value => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) : '—';
export const priceText = value => typeof value === 'number' ? `${numberText(value)} ₽` : 'Цена уточняется';
export const apartmentTitle = item => `${item.apartment?.isStudio || item.apartment?.rooms === 0 ? 'Студия' : item.apartment?.rooms ? `${item.apartment.rooms}-комнатная` : 'Квартира'}, ${numberText(item.area)} м²`;
