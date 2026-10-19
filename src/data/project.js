// Legacy target keys accepted from Unreal; never used as displayed API content.
// Descriptions come only from GET /api/sections and /api/presentation/objects.
export const defaultProjectTarget = null;
export const projectTargets = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(number => ({ id: `section-${number}`, label: `Секция ${number}`, description: [] })),
  { id: 'business-center', label: 'Деловой центр', description: [] },
  { id: 'parking', label: 'Паркинг', description: [] },
  { id: 'storage', label: 'Кладовые', description: [] },
];
