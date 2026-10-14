import { projectTargets, defaultProjectTarget } from './project.js';

// These labels and default keys are shown only until the API responds.
const targets = entries => entries.map(([id, label, room]) => ({ id, label, room, description: [] }));

export const detailChapters = {
  project: { label: 'О проекте', targets: projectTargets, defaultTarget: defaultProjectTarget, background: 'assets/background.png' },
  architecture: {
    label: 'Архитектура', defaultTarget: 'pilasters', background: 'assets/chapters/architecture/background.png',
    targets: targets([['arches', 'Арки'], ['columns', 'Колонны'], ['pilasters', 'Пелястры'], ['balconies', 'Балконы']]),
  },
  park: {
    label: 'Внешний пояс', defaultTarget: 'bratva', background: 'assets/chapters/park/background.png',
    targets: targets([['square', 'Площадь'], ['bratva', 'Братва'], ['benches', 'Лавочки'], ['amphitheater', 'Амфитеатр'],
      ['chandelier', 'Люстра'], ['restaurant', 'Ресторан'], ['park', 'Парк'], ['business-center', 'Деловой центр']]),
  },
  courtyard: {
    label: 'Внутренний двор', defaultTarget: 'fish-art', background: 'assets/chapters/courtyard/background.png',
    // The Figma heading says «Ротондо» while «Артобъект Рыбы» is selected. Keep heading consistent with selection.
    targets: targets([['quiet-rest', 'Тихий отдых'], ['fish-art', 'Артобъект Рыбы'], ['flowerbed', 'Клумба'], ['outdoor-lounge', 'Уличная гостиная']]),
  },
  entrance: {
    label: 'МОПы', defaultTarget: 'playroom', background: 'assets/chapters/entrance/background.png',
    targets: targets([['grand-lobby', 'Гранд-Лобби', 'Помещение 2'], ['playroom', 'Детская игровая', 'Помещение 1'], ['gym', 'Спортзал', 'Помещение 3']]),
  },
};

export const objectChapterIds = ['architecture', 'park', 'courtyard', 'entrance'];
export const defaultChapterTargets = () => Object.fromEntries(objectChapterIds.map(id => [id, detailChapters[id].defaultTarget]));
export const isChapterTarget = (chapter, target) => objectChapterIds.includes(chapter) && detailChapters[chapter].targets.some(item => item.id === target);
