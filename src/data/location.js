// Filter identifiers sent to Unreal. Marker positions and scene objects belong to Unreal.
export const locationCategories = [
  { id: 'nursery', label: 'Детские сады', color: '#ef5350', icon: 'nursery-inactive' },
  { id: 'pickup', label: 'ПВЗ', color: '#7e57c2' },
  { id: 'cafe', label: 'Кафе', color: '#ab47bc' },
  { id: 'sport', label: 'Спорт', color: '#42a5f5' },
  { id: 'bank', label: 'Банки', color: '#29b6f6' },
  { id: 'school', label: 'Школы', color: '#26a69a' },
  { id: 'health', label: 'Здоровье', color: '#26c6da' },
  { id: 'shop', label: 'Магазины', color: '#ec407a' },
  { id: 'bus', label: 'Остановки', color: '#5c6bc0' },
];

export const presentationChapters = [
  { id: 'location', label: 'Локация', icon: 'location', available: true },
  { id: 'project', label: 'О проекте', icon: 'project', available: true },
  { id: 'architecture', label: 'Архитектура', icon: 'architecture', available: true },
  { id: 'park', label: 'Внешний пояс', icon: 'park', available: true },
  { id: 'courtyard', label: 'Внутренний двор', icon: 'courtyard', available: true },
  { id: 'entrance', label: 'МОПы', icon: 'entrance', available: true },
];

export const defaultCategories = () => locationCategories.map(category => category.id);
