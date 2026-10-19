# Отдельные панели в Unreal

## Прокрутка без полос — 19.10.2026

В общем `widget.css` скрыты нативные полосы всех элементов: `scrollbar-width:none`
и `::-webkit-scrollbar` с display:none/нулевыми размерами. Приоритет правил
перекрывает прежние локальные `scrollbar-width:thin`. Overflow и сами области
прокрутки сохранены, в том числе описание, списки менеджеров/квартир, галерея.

В `ProjectPanel.vue` общий ряд `.project-targets` для project/architecture/park/
courtyard/entrance использует overflow-x:auto, overflow-y:hidden, ограничение
ширины контейнером. Колесо мыши переводится в горизонтальное перемещение;
горизонтальное движение тачпада также поддерживается. Ctrl+wheel не перехватывается.
Мышью можно тянуть ряд за кнопки: после порога 8 px включается захват указателя,
клик после перетаскивания подавляется. Обычный клик и Enter по кнопке сохранены.
Для touch оставлена нативная прокрутка `touch-action:pan-x` без JS-перетаскивания.
Изолированный BrowserNavigation и полный интерфейс используют один компонент.

Данные — существующий API объектов глав, новых маршрутов/команд/параметров нет.
URL, UMG-размеры, видимость и обратный setState не меняются. Полный архив:
`idel-widget-2026-10-19-hidden-scrollbars-full.zip`. Установка: остановить Play,
распаковать содержимое поверх `D:/UE_PROJECTS/IDEL/Content/idel-widget/`, заменить
файлы. Blueprint не изменять. Для проверки открыть главу с достаточным количеством
объектов, прокрутить к последнему, затем выбрать его; карточка и событие выбора
должны появляться только от клика, а не от перетаскивания. Открыть длинное описание
и проверить вертикальную прокрутку без видимой полосы.

Подтверждено в Chrome по локальной сборке 19.10: горизонтальное колесо/перетаскивание,
отсутствие выбора при drag, выбор кликом/Enter и прокрутка фокуса к последней кнопке,
переполнение ряда при 910×180 и 390×180, скрытые полосы и сохранённая вертикальная
прокрутка BrowserDescription 297×280. npm run build, npm test, panels.test.cjs и
presentation-panels.test.cjs прошли. Сенсорный свайп на устройстве, Unreal Play
и packaged build ещё не проверены.

## Обработчик камеры: начало сборки — 16.10.2026

17.10.2026, скриншот пользователя 21:14 Windows в Play: временный Print String
между True проверки события и вызовом обработчика вывел JSON
`scene.requestPresentationCamera`, params: chapter=`project`, scope=`object`,
id=1741, target=`section-1`, cameraCoordinates=`222`, sceneObjectKey=null.
Подтверждены отправка события для Секции 1 и прохождение ветки до Print в Unreal;
разбор JSON внутри функции, наличие найденного компонента и движение камеры
этим не подтверждены. Пользователь ранее сообщил, что перехода нет.
На скриншоте активен `Main_WP` (Play In Editor), а точка с PointID=222 ранее
осматривалась на `L_Layout_Test`. Наличие такой точки в загруженном Main_WP
нужно проверить; отсутствие пока не доказано. Дизайнерские точки не менять
и не переносить без отдельного согласования. Print String — временная
диагностика, после проверки убрать, восстановив прямой True → обработчик.

17.10.2026, скриншот пользователя 21:05 Windows: в Event Graph добавлены
Contains с Substring=`"method":"scene.requestPresentationCamera"`, Branch
и вызов `Handle Presentation Camera Command` (Target=self). Contains.Return Value
→ Condition Branch; True → белый вход вызова; Return Value существующего Replace
(From=`IDEL:`, To=пусто) → Json String вызова, напрямую, без Append.
Search In Contains и Source String Replace имеют входящие провода от прежней
цепочки Message; их исходный узел и точка входа белого провода находятся вне
этого кадра, ранее указано подключать от False проверки ui.presentation.description
именно BrowserNavigation. Новая ветка на этом скриншоте ещё не скомпилирована
(жёлтый значок Compile), `1 Unsaved`; прежнее подтверждение Compile/Save относится
к состоянию до добавления ветки. Следующая проверка: Compile без ошибок → Save →
Play → выбрать объект API с cameraCoordinates, совпадающим с PointID точки
BP_EnvViewpoint на активном уровне. Ожидается описание объекта и переход к его
камере. Значение 222 — ранее показанный пример точки, не подтверждение значения
конкретного элемента API. Проверка движения в Play ещё не выполнена.

17.10.2026, скриншот пользователя 20:50 Windows: `wbp-idelpreview` без
звёздочки, Compile зелёный, `All Saved` — сохранение собранного обработчика
подтверждено в редакторе. В Event Graph у Branch, Condition которого приходит
из Contains с Substring=`"method":"ui.presentation.description"`, выход False
свободен. Это точка расширения цепочки BrowserNavigation; другой Branch справа
проверяет `"visible":true` и управляет BrowserDescription — его не менять.
Ветка события камеры ещё не подключена, выполнение в Play не подтверждено.

17.10.2026, скриншоты пользователя 20:47 Windows: добавлен `Get Player Pawn`
с Player Index=0; Return Value → Object `Cast To BP_OrbitCameraPawn`.
True Branch сравнения PointID → белый вход этого Cast; успешный белый выход
Cast → белый вход `Move to Viewpoint`; `As BP Orbit Camera Pawn` → Target
вызова; `As BPC Env Viewpoint` предыдущего Cast → Viewpoint вызова.
Белый выход Move → Break `For Each Loop with Break`; Completed цикла
остаётся свободным. На более позднем из двух скриншотов Compile зелёный,
у Cast компонента синяя NOTE (текст примечания не раскрыт). Сохранение
не подтверждено: `1 Unsaved`. Сам обработчик собран по видимым проводам,
но его вызов из BrowserNavigation и переход в Play ещё не подтверждены.
Проверка следующего этапа: сохранить наш wbp-idelpreview, подключить вызов
только для scene.requestPresentationCamera с JSON без IDEL:, затем в Play
выбрать реальный объект с известным PointID. Дизайнерские Blueprint не менять.

17.10.2026, подтверждено скриншотом пользователя (20:41 Windows):
`Get Component by Class.Return Value` → `Cast To BPC_EnvViewpoint.Object`;
белый `For Each Loop with Break.Loop Body` → вход Cast; успешный белый выход
Cast → вход Branch сравнения. `As BPC Env Viewpoint` → `Target` Get Point ID;
`Point ID` → первый вход Equal (Name). Локальный Get `PresentationCameraId`
(String) → String to Name → второй вход Equal (Name); результат равенства
→ `Branch.Condition`. Оба выхода Branch пока свободны. Это подтверждение
соединений в редакторе; выполнение сравнения, Compile/Save, Play ещё не
подтверждены (`1 Unsaved`). MoveToViewpoint и Break пока не подключены.

Состояние 17.10.2026, скриншот пользователя с часами Windows 10:19:
после `Set PresentationCameraId` белый провод идёт в `Get All Actors Of Class`
(Actor Class=`BP_EnvViewpoint`), затем в Exec `For Each Loop with Break`.
`Out Actors` подключён к `Array` цикла; `Array Element` → `Target`
`Get Component by Class` (один компонент, Component Class=`BPC_EnvViewpoint`).
`Loop Body`, `Break`, `Completed` и `Return Value` получения компонента пока
свободны. Сравнение PointID и вызов MoveToViewpoint ещё не реализованы.
Compile/Save и Play не подтверждены (`1 Unsaved`). Это подтверждение сборки
части графа в редакторе, не выполнения обработчика.

Подтверждено скриншотом пользователя в редакторе (19:37 по времени Windows
на скриншоте): в нашем `wbp-idelpreview` создана функция
`HandlePresentationCameraCommand`, вход `JsonString` типа **String**.
Внутри добавлен `Load Json from String`: белый выход входного узла функции
подключён к белому входу Load; розовый выход `Json String` входного узла
подключён напрямую к `Json String` Load. Дополнительный Get Json String и
преобразование Boolean в String не нужны.

Состояние на 16.10.2026: два прямых провода — белый и розовый; выходы Load
`Json Object` и `Success` пока свободны. На скриншоте `1 Unsaved`, успешные
Compile/Save не подтверждены. Это незавершённый обработчик, к Event Graph
ещё не подключён; разбор params, поиск PointID и переход камеры не реализованы.
Версия/архив виджета не установлены по этому скриншоту. Проверки Play нет.

Продолжение 17.10.2026, подтверждено скриншотом пользователя: после Load
добавлен Branch с Condition от его Success; True ведёт в Get Field с
Field Name=`params`. После него второй Branch с Condition от Success,
True ведёт в Get Field с Field Name=`cameraCoordinates`. После второго
Get Field третий Branch с Condition от его Success. Выход Value второго
Get Field ещё серый (тип не задан), True последнего Branch свободен.
Синий провод к Json Object второго Get Field должен приходить именно от
Value Get Field `params`, не напрямую от Load; на скриншоте провод идёт
на одной высоте с несколькими пинами, источник требует дополнительной сверки.
Compile/Save не подтверждены (`1 Unsaved`), подключение к Event Graph и
переход камеры в Play не проверены. Предыдущая запись о свободных выходах
Load описывает только состояние 16.10, а не текущий граф.

Следующий подтверждённый этап — скриншот пользователя 17.10.2026 с часами
Windows 09:39: `PresentationCameraId` находится в Local Variables функции
`HandlePresentationCameraCommand`, тип String. `Value` Get Field
`cameraCoordinates` стал розовым и подключён к значению
`Set PresentationCameraId`; True последнего Branch подключён к белому входу
Set. На этом скриншоте также видно прямое соединение `Value` Get Field
`params` → `Json Object` Get Field `cameraCoordinates`: прежняя неоднозначность
источника снята. Белый выход Set свободен. Поиск компонентов и вызов камеры
ещё не добавлены, Compile/Save и Play не подтверждены (`1 Unsaved`).

## Исследование Point ID — 16.10.2026, только просмотр

Через Windows App в Unreal Editor проверен уровень `L_Layout_Test`: экземпляр
`BP_EnvViewpoint`, компонент `Viewpoint`, раздел Details `View Environment`,
`Point ID = 222`. Открыт `/Game/OrbitCameraSystem/Camera/BPC_EnvViewpoint`:
переменная `PointID` имеет тип **Name**, родитель — `BPC_Viewpoint`.
У родителя существуют `GetResolvedViewData` и `CopyFromViewpoint`.
Поиск Find in Blueprints по `GetResolvedViewData` показывает её вызов внутри
`/Game/OrbitCameraSystem/Camera/BP_OrbitCameraPawn`, функция `MoveToViewpoint`.
Это подтверждение структуры в редакторе, не проверка движения в Play.
Вход `MoveToViewpoint` проверен в редакторе после открытия пользователем другого
окна Blueprint: Access Specifier = Public; единственный вход `Viewpoint` —
ссылка на объект компонента `BPC_Viewpoint`, выходных параметров нет.
Белая цепочка начала функции: `MoveToViewpoint` → `Set Current Viewpoint` →
`Get Resolved View Data` → `Set View Data` → `Set Is Orbiting` (false) →
`Set Is Panning` (false) → `Set Anchor Location` → `Set Target Focus Location`.
Данные: вход `Viewpoint` → значение `Current Viewpoint`; выход установленного
`Current Viewpoint` → `Target` узла `Get Resolved View Data`; его `Resolved` →
`View Data`. Из `Break S Resolved View Data` выход `Focus Location` подключён
к `Anchor Location` и `Target Focus Location`. Продолжение функции полностью
не изучено; алгоритм анимации и вызов маркером в Play не проверялись.
Вызывающая цепочка маркера и поиск по ID ещё требуют просмотра.
Рабочая интеграция по этим сведениям пока не подтверждена.

Предлагаемое подключение, **ещё не реализовано**: в нашем обработчике получить
`params.cameraCoordinates`, преобразовать строку в Name, найти компонент
`BPC_EnvViewpoint` с равным `PointID` и передать ссылку на него в пин `Viewpoint`
существующего `MoveToViewpoint`; `Target` вызова должен быть действующим
`BP_OrbitCameraPawn` игрока. Это потомок `BPC_Viewpoint`, поэтому функция
принимает его как базовый тип. ID не подставлять непосредственно в объектный
пин. Способ перечисления точек и получения действующего Pawn ещё сверить;
при отсутствии точки/невалидном Pawn переход не вызывать. Ничего в
дизайнерском `MoveToViewpoint` для этого менять не требуется.

Дизайнерские Blueprint разрешено только читать. Новую маршрутизацию реализовывать
в наших интеграционных Blueprint, вызывая существующий переход. Сначала сверить
сигнатуру функции и способ получения компонента; не заменять дизайнерскую камеру.
Параметр события `scene.requestPresentationCamera.params.id` — ID записи API,
а строка камеры приходит в `params.cameraCoordinates`; не считать API ID равным
`PointID`. Применение строки `cameraCoordinates` как Point ID — сценарий пользователя,
который ещё нужно проверить на одном реальном элементе и в Play.

Воспроизведение просмотра: выбрать `BP_EnvViewpoint` в Outliner уровня
`L_Layout_Test` → компонент `Viewpoint` → сверить `Point ID` в Details;
открыть `BPC_EnvViewpoint` в `/Game/OrbitCameraSystem/Camera` и проверить тип
`PointID`; через Find in Blueprints найти `GetResolvedViewData` и открыть
`BP_OrbitCameraPawn.MoveToViewpoint`. Ожидается увидеть существующий вызов
получения данных точки. Версия/архив установленного виджета для этого просмотра
не определялись; Blueprint-подключения и JavaScript не изменялись.

## Актуально: сброс выбранной точки — 16.10.2026

Новое требование пользователя заменяет прежнее восстановление выбранного объекта при возврате. Начальные projectTarget и все chapterTargets равны null. При любой смене view (клик главы или setState из Unreal) прежние точки сбрасываются; начальный вход и reset сессии также не выбирают точку. Выбор появляется только после клика объекта либо явного IdelWidget.selectObject/setState с target.

Смена главы в Navigation отправляет ui.presentation.state с projectTarget=null и chapterTargets={architecture:null,park:null,courtyard:null,entrance:null}, затем ui.presentation.description с пустым текстом, visible=false, target=null. Уже подключённая ветка BrowserDescription сворачивает карточку. Общая камера главы по-прежнему вызывается, отдельная камера точки автоматически не выбирается. setState принимает null для снятия выбора без эха. Если в Unreal отдельно реализована подсветка нативного Actor, её сброс необходимо связать с этим состоянием; такая подсветка ещё не проверена.

Проверка: открыть «О проекте» — ни одна кнопка объекта не выделена; выбрать Секцию 1 — выделение/описание появляются; перейти в МОПы — выбор секции снят и описание скрыто, ни один МОП не выбран; вернуться — Секция 1 не восстанавливается. Выбрать объект можно новым кликом. Схема передачи данных/видимости BrowserDescription не меняется. Более ранние инструкции о восстановлении ниже — история прежнего требования.

## Объекты только из API — 16.10.2026

Build прошёл с ранее описанным временным обходом чтения Node. Браузерные проверки прошли: presentation-data-state.test.cjs (задержка без заглушек, отказ/повтор, объект только из API, пустой раздел), presentation-panels.test.cjs (включая возврат описания), panels.test.cjs и npm test. Установка в Play этой версии ещё не подтверждена. Патч idel-widget-2026-10-16-server-objects-only.zip содержит build/app.js, project.css и инструкции; распаковать поверх текущей установки без удаления остальных файлов. Blueprint остаётся прежним.

Убрана подстановка локальных projectTargets/detailChapters.targets в отображаемый список объектов: до ответа API кнопки секций/объектов не рисуются. Показывается «Загрузка объектов…», при отказе — ошибка и «Повторить», при успешном пустом items — «В этом разделе пока нет объектов». Повтор читает через тот же gateway BrowserSession (или напрямую в standalone), без изменения Blueprint. Тексты описаний остаются только из API. Названия шести глав и категории инфраструктуры — локальная конфигурация управления, а не подставной ответ сервера.

В коде отдельно сохранён явно включаемый деморежим входа realSession=false для тестов. В поставляемом index.html realSession=true; эта правка объектов не удаляет деморежим авторизации. Идентификаторы первоначального выбора в state не считаются загруженными объектами и не порождают кнопки без API.

## BrowserDescription: текст и возврат в главу — 16.10.2026

Обновление поставляется патчем idel-widget-2026-10-16-description-return.zip: build/app.js и инструкции, без неизменённых медиа. Распаковать поверх установленного idel-widget с заменой файла, сохранив assets и остальные файлы; остановить Play до замены. panels.test.cjs прошёл отдельно. npm test повторно остановился на page.goto timeout 90s; его прохождение в этой сборке не подтверждено.

Локальная проверка исправления: presentation-panels.test.cjs прошёл с регрессией возврата entrance → location → entrance и проверкой пустого текста. В открытой локальной вкладке http://127.0.0.1:5175/?mode=unreal&panel=navigation&data=standalone с живым API проверено: Секция 1 → Локация → О проекте, без повторного клика пришло ui.presentation.description с title=Секция 1, visible=true, «21 этаж», «365 квартир». Это подтверждение отправки восстановленного текста в браузере; отдельный UMG-показ после обновления ещё проверить в Play. Дополнительный data-hub.test.cjs остановился на тайм-ауте открытия страницы владельца, не на проверке описания.

Обычная сборка дважды остановилась на обрезанном асинхронном чтении session.js; отдельные readFileSync/синтаксические проверки читали полный файл. Сборка прошла с временным Node preload, заменяющим fs.promises.readFile на синхронное чтение; preload находится только в /private/tmp и в архив не включается. Runtime приложения этого обхода не требует.

Запись экрана пользователя подтвердила в Play показ и смену описаний секций. Возврат после другой главы оставлял карточку скрытой: Navigation отправлял visible=false, но не восстанавливал описание сохранённого объекта. Новая версия selectChapter ждёт контент и повторяет ui.presentation.description для выбранного объекта. Устаревшие переключения отсекаются проверкой главы/номера выбора. Пустой текст оставляет карточку скрытой. Исправление возврата ещё требует проверки в Play.

BrowserDescription: Web Browser, Is Variable/Supports Transparency=true, URL `file:///D:/UE_PROJECTS/IDEL/Content/idel-widget/index.html?mode=unreal&panel=description`, anchors/alignment=(0,0), position=(40,420), size=297×280, начальная Visibility=Collapsed. Размещение сверять с DPI.

В wbp-idelpreview: On Console Message (BrowserNavigation) → Branch data.request, его False → Branch ui.presentation.description. Для второго Branch: Contains Search In=Message BrowserNavigation, Substring=`"method":"ui.presentation.description"`, Return Value=Condition. True белым проводом → Execute Javascript Target=BrowserDescription. Script Text=Append: A=`window.IdelWidget.setState((`, B=Message после Replace From=`IDEL:` To=пусто, C=`).params);`.

Белый выход Execute Javascript → Branch видимости; Condition=Contains с Search In=тот же Message BrowserNavigation, Substring=`"visible":true`. True → Set Visibility Target=BrowserDescription, Visible; False → Set Visibility того же Target, Collapsed. Не запускать эту проверку от On Console Message BrowserDescription: полученные params он не повторяет. Все белые входы должны быть соединены; одного Script Text недостаточно. Временные Print String не нужны для работы.

Проверка новой версии: О проекте → Секция 1 → Локация → О проекте: описание Секции 1 возвращается без повторного клика. Для Секции 6 с пустым текстом карточка не появляется. Восстанавливается текст; переход главы по-прежнему использует общую камеру главы, камера секции дополнительно не вызывается. Существующий Blueprint менять не нужно.

## Актуальное изменение 16.10.2026: единый кэш

Отдельные панели по умолчанию получают общие данные от BrowserSession через Unreal. Перед установкой новой сборки подключить data.request/data.response по [DATA_CACHE.md](DATA_CACHE.md). Прежние описания самостоятельных API-запросов панелей ниже относятся к предыдущей версии/standalone. BrowserDescription получает только готовый текст через setState. BrowserSession сохранять живым после Collapsed и logout. Новый обмен в Play ещё не подтверждён.

## Объекты презентации: новые отдельные Browser — 15.10.2026

Уточнение пользователя: дизайнер уже настроил точки и переходы к нужным сценам,
нажатие существующих точек вручную проверено им. Нужно вызвать эти же действия,
не создавать новые Camera Actor/движение камеры. Имена действующих Blueprint
и функции перехода ещё нужно сверить в самом Unreal.

Камеры разделены: GET /api/presentation/chapters → cameraCoordinates из
UF_MAIN_CAMERA раздела — общий вид при выборе главы. GET объектов →
cameraCoordinates из CAMERA_COORDINATES элемента — вид конкретной точки.
Значения строковые, не разбираются как координаты и не заменяются на target/ID.
В panel=navigation выбор с непустой камерой отправляет дополнительное событие
scene.requestPresentationCamera: `{chapter,scope:'chapter'|'object',id,target,
cameraCoordinates,sceneObjectKey}`. Для общей камеры id=ID раздела, target=null;
для точки id=ID элемента API, target=ключ кнопки. При пустом поле событие камеры
не отправляется; отсутствие камеры не мешает показу описания. setState камерных
событий не отправляет. Передавать cameraCoordinates в существующую функцию
дизайнерской точки в Unreal; реальные переходы этой цепочкой ещё не проверены.

15.10.2026 чтением живого API подтверждены тестовые значения пользователя:
раздел project ID 133 → "111"; courtyard-first-stage ID 1721 → "222";
courtyard-second-stage ID 1775 → "111". Это проверка транспорта строк,
не подтверждение существования камер с такими ID в Unreal.
Секции из /sections и элементы project могут иметь одинаковый target:
загрузчик объединяет их в одну кнопку, поля камеры элемента дополняют секцию,
непустое описание сохраняется. Повторы внутри одного ответа по-прежнему ошибка.

В Vue реализованы URL `?mode=unreal&panel=navigation` и
`?mode=unreal&panel=description`. Они заменяют прежний план ниже, где эти URL
помечены отсутствующими. Реальная маршрутизация в Blueprint ещё не выполнена.

- BrowserNavigation: 910×180 CSS px, низ по центру, anchors=(.5,1),
  alignment=(.5,1), position=(0,-40) при DPI 1; размер UMG сверять с DPI проекта.
  Только контекстный ряд фильтров/объектов и шесть глав: Локация, О проекте,
  Архитектура, Внешний пояс, Внутренний двор, МОПы. Начальное view=location.
- BrowserDescription: 297×280 CSS px, слева под окружением, ориентир
  position=(40,420), anchors/alignment=(0,0); высоту/позицию сверить с реальным
  BrowserEnvironment, длинный текст прокручивается. Описание выбранного объекта
  и кнопка «Вид» для МОПов. Начальное view=project.
- Оба Browser: Supports Transparency=true, Is Variable=true, начальная
  Visibility=Collapsed. Фон 3D, камера, погода и Toolbar не дублируются.

Данные: существующий `usePresentationContent`: GET /api/sections и
GET /api/presentation/objects?chapter=project для проекта, тот же маршрут
с chapter=architecture|park|courtyard|entrance для остальных глав.
С 16.10.2026 Navigation читает эти наборы через BrowserSession; Description получает готовые title/description без API. Локация использует локальные идентификаторы категорий; размещение маркеров принадлежит Unreal. При пустом описании BrowserDescription должен быть Collapsed (см. DATA_CACHE.md).

Синхронизация (план подключения, не готовая Blueprint-интеграция):
1. Toolbar на ui.info и scene.home, Navigation при выборе главы/объекта/фильтра
   дополнительно отправляют `ui.presentation.state` с params:
   `{view,categories,projectTarget,chapterTargets}`. Существующие события сцен
   сохраняются. Телефон, токен и материалы в этом сообщении отсутствуют.
2. On Console Message (BrowserToolbar) и (BrowserNavigation): выделить обычный
   IDEL JSON, для method=ui.presentation.state передать объект params всем
   трём экземплярам: Toolbar, Navigation, Description через Execute Javascript
   с правильным Target и `window.IdelWidget.setState(<params>);`.
   setState не отправляет обратных событий, петли не создаёт.
3. view=home: Navigation и Description Collapsed. view=location: Navigation
   Visible, Description Collapsed. Для project/architecture/park/courtyard/entrance:
   Navigation Visible, Description — только при ui.presentation.description visible=true. На session.ended оба Collapsed; перед новым входом установить
   согласованное начальное состояние. Toolbar обновлять вместе с ними, чтобы
   повторное нажатие info корректно возвращало home.
4. Камеры/Actor, scene.setInfrastructure, scene.selectProjectTarget,
   scene.selectChapterTarget и scene.requestInteriorView подключаются отдельно
   к реальным объектам. Наличие UI не подтверждает движение камеры в Play.

Проверять: info открывает навигацию; смена главы меняет контекстный ряд и
описание; выбор МОП/секции меняет текст; Домой скрывает обе панели и возвращает
Toolbar в home; выход скрывает их. Play/packaged build ещё не проверены.

15.10.2026: пользователь подтвердил регистрацию нового клиента через
BrowserSession в Play, вход в презентацию, создание клиента в Битриксе и
привязку MANAGER. Сценарий воспроизведения —
[MANAGERS_CLIENTS.md](../idel-backend/docs/MANAGERS_CLIENTS.md#регистрация-из-unreal--подтверждение-15102026).
Это не подтверждает передачу токена между Browser, серверное избранное,
загрузку PNG клиенту или packaged build.

## Очистка снимков при выходе — Play, 15.10.2026

Подтверждение пользователя: оба PNG удалились (включая снимок, ранее удалённый
из списка Vue), после нового входа «Сохранённое» пустое. Точная версия архива
не сверена. Удаление чужих/старых PNG, ошибки удаления и packaged build отдельно
не проверены. Эта запись актуализирует более ранние пометки «ещё не подключено».

Предусловия: каждый успешно полученный PNG в FinishScreenshotCapture добавляется
через Add Unique в переменную виджета SessionScreenshotPaths (String Array).
При удалении карточки этот массив не менять. Выход BrowserExit вызывает
`window.IdelSession.reset({save:false});` в BrowserSession; очистка запускается
в ветке `session.ended`, а не по самому нажатию кнопки.

Функция `/Game/wbp-idelpreview.CleanupSessionScreenshots`, без входов:
1. Создать локальную PathsToDelete типа String Array (Local Variables функции).
   Вход функции → Set PathsToDelete; значение Set получает Get SessionScreenshotPaths.
2. Белый выход Set → Exec For Each Loop. Array цикла получает отдельный
   Get PathsToDelete. Копия нужна, чтобы основной массив можно было менять при обходе.
3. Loop Body → Delete File (Blueprint File Utils), Filename=Array Element,
   Must Exist=false, Even If Read Only=false. Никакого Delete Directory.
4. Белый выход Delete File → Branch, Condition=Return Value удаления.
   True → Remove Item: Target Array=Get SessionScreenshotPaths, Item=Array Element
   цикла. False → Print String: In String=Array Element, чтобы видеть неудачный путь.
   Не очищать весь SessionScreenshotPaths: пути с ошибками остаются для повтора.
5. EventGraph: в конце подтверждённой ветки session.ended после переключения
   видимости вызвать CleanupSessionScreenshots (Target=self), затем два
   Execute Javascript: Target=BrowserToolbar и Target=BrowserSaved.
   Script Text в каждом: `window.IdelApartments.resetMaterials();`.
   Вход сессии/выход из BrowserSession описан ниже; его reset очищает собственную сессию.

Проверка для воспроизведения: Compile → Save → Play → вход → два снимка;
записать имена и пути PNG, один снимок удалить крестиком из Saved; нажать
BrowserExit. Убедиться, что оба конкретных файла исчезли; снова войти и открыть
Saved — список должен быть пустым. Пользователь подтвердил именно этот результат.
На этом шаге проверка выполнялась без сохранения избранного (save:false).

## Выход и видимость панелей — Play, подтверждено пользователем 15.10.2026

В BrowserExit событие On Console Message → Branch с Condition от Contains:
Search In=Message, Substring=`"method":"ui.session.end"`. True → Execute
Javascript, Target=BrowserSession, Script Text=`window.IdelSession.reset({save:false});`.
Это выход без сохранения избранного. Обработчик On Console Message (BrowserSession):
первый Branch проверяет Contains `"method":"session.started"` в Message;
True → BrowserSession Collapsed → BrowserEnvironment Visible → BrowserToolbar
Visible → BrowserExit Visible (Set Visibility с соответствующим Target).
False первого Branch → второй Branch с Contains `"method":"session.ended"`;
True → BrowserSaved Collapsed → BrowserToolbar Collapsed → BrowserEnvironment
Collapsed → BrowserExit Collapsed → BrowserSession Visible.
Начальная видимость Designer: Session Visible, остальные четыре Collapsed.
Пользователь сообщил «всё норм» после подключения. Отдельная очистка материалов
Toolbar/Saved и удаление PNG пока не подтверждены, packaged build не проверен.

## BrowserExit — кнопка выхода по Figma (15.10.2026)

Источник: Figma `7U00j5LuevrNh4HkzqaumQ`, `364:62688` (Log out).
Узел `141:6946` — изображение сцены, не размещение кнопки; фон в Unreal
остаётся живой сценой. Пользователь выбрал отдельную панель справа внизу.
URL: тот же index.html с `?mode=unreal&panel=exit`.
SessionExitButton использует существующий `assets/apartments/exit.svg`:
он побайтово совпал с выгруженной иконкой Figma, размер SVG 36×36.
Кнопка 96×100 CSS px, padding 32px 30px, радиус 16px, белый фон 90%, blur 4px.
Данные/API для отображения не нужны. Текстовой кнопки в Saved нет.

Подключение (план до проверки в Play):
1. Добавить Web Browser в Canvas `/Game/wbp-idelpreview`, назвать BrowserExit,
   включить Is Variable и Supports Transparency.
2. Anchors Min=Max=(1,1), Alignment=(1,1), Size=(96,100), Position=(-40,-40)
   в единицах UMG; проверить фактический масштаб DPI проекта. ZOrder выше
   сцены и ниже полноэкранных модальных Browser. Не растягивать на весь экран.
3. Initial URL — рабочий путь к index.html + `?mode=unreal&panel=exit`.
   До входа Visibility=Collapsed, после входа Visible; на окончание сессии
   снова Collapsed. При скрытии интерфейса можно передать
   `window.IdelWidget.setState({hidden:true})`, при показе hidden:false.
4. On Console Message (BrowserExit) принимает обычный `IDEL:` JSON,
   кнопка отправляет method=`ui.session.end`, params={}. Маршрутизация к
   владельцу BrowserSession и способ завершения ещё не подключены.
   Не считать запрос подтверждением выхода и не удалять PNG до завершения.

Кнопка в браузере должна показывать красную иконку выхода и отправлять
ровно один ui.session.end за клик. Реальный session.ended, очистка материалов,
удаление файлов SessionScreenshotPaths, Play и packaged build требуют
отдельной проверки. Предыдущая текстовая кнопка Saved отменена пользователем.

## Снимки: рабочая передача Toolbar → Saved (Play, 15.10.2026)

### Удаление карточки — подтверждено пользователем 15.10.2026

В `On Console Message (BrowserSaved)` из False проверки `ui.panel.close`
вести белый провод в Branch удаления. Его Condition: строковый Contains,
Search In=Message этого события, Substring=`"method":"ui.saved.removeScreenshot"`.
Тот же Message → Replace (From=`IDEL:`, To=пусто) → B строкового Append:
A=`var m=`, C=`;window.IdelApartments.removeScreenshot(m.params.id);console.log("IDEL_MATERIALS:"+JSON.stringify(window.IdelApartments.getMaterials()));`.
True Branch → Execute Javascript, Target=BrowserToolbar, Script Text=Append.
Ответ `IDEL_MATERIALS:` принимает существующая цепочка Toolbar и передаёт
в BrowserSaved через setMaterials. Пользователь подтвердил: снимок добавляется,
удаляется и не возвращается после повторного открытия. Не терять запрос
getMaterials в ветке сердца; без него список перестаёт обновляться.
PNG при удалении карточки не удаляется, путь остаётся в SessionScreenshotPaths
для будущей очистки на выходе. Очистка файлов пока не подключена.

### Ограничение выхода в отдельных панелях

По исходникам 15.10.2026 кнопка «Выйти из сессии» и её диалог доступны через
кнопку только в full (вне apartments). В отдельных toolbar/saved/environment
такой кнопки нет. App.reset отправляет session.ended только в экземпляре,
имеющем session.value; отдельный Toolbar не наследует сессию BrowserSession.
Для выхода в многобраузерной схеме требуется отдельно реализовать UI и
маршрутизацию к владельцу сессии, затем очистку PNG в Unreal.

Подтверждено скриншотом пользователя: BrowserSaved показывает «Скриншоты 1»,
загруженную миниатюру и счётчик «1 снимков». Точная версия архива на Windows
не сверена. Удаление, выход из сессии и packaged build этим не подтверждены.

Предусловия: в `/Game/wbp-idelpreview` существуют BrowserToolbar
(`?mode=unreal&panel=toolbar`) и BrowserSaved (`?mode=unreal&panel=saved`).
Используйте фактический путь к одному и тому же index.html на Windows.
BrowserSaved полноэкранный, начальная Visibility=Collapsed, Render Opacity=1.
BrowserToolbar владеет снимками: камера отправляет `scene.screenshot`, Unreal
создаёт PNG и вызывает в BrowserToolbar
`window.IdelApartments.setScreenshot({captureId,url})` с исходным captureId
и доступным `file:///D:/…/ScreenShot….png`. В Play подтверждались
`IDEL_SCREENSHOT_RESULT true` и загрузка PNG. Для полёта миниатюры нужны
включённые эффекты анимации Windows (ранее мешал reducedMotion=true).

1. В EventGraph обработчик `On Console Message (BrowserToolbar)` проверяет
   Message через Contains с подстрокой `"method":"ui.favorites"` → Condition
   Branch. Предшествующая обработка камеры сохраняется; сюда ведёт её False.
2. True сердца → Execute Javascript, Target=BrowserToolbar, Script Text:
   `console.log("IDEL_MATERIALS:"+JSON.stringify(window.IdelApartments.getMaterials()));`
   Затем Set Visibility (Target=BrowserSaved, Visible) → Execute Javascript
   (Target=BrowserSaved, `window.IdelWidget.setState({view:"saved",hidden:false});`).
   На показанной рабочей схеме после него Set Render Opacity=1 для BrowserSaved.
3. Ответ приходит асинхронно новым сообщением того же BrowserToolbar.
   False Branch сердца → отдельный Branch; его Condition получает Return Value
   строкового Starts With: Source String=исходный Message события,
   In Prefix=`IDEL_MATERIALS:`. Не подключать его к Source или Line события.
4. От того же Message → строковый Replace: Source String=Message,
   From=`IDEL_MATERIALS:`, To=пусто. Это отдельный Replace: существующий
   Replace с From=`IDEL:` для команд камеры не менять. Ошибка From=`IDEL:`
   здесь оставляла префикс в JavaScript, и список не наполнялся.
5. Строковый Append с тремя входами: A=`window.IdelApartments.setMaterials(`,
   B=Return Value нового Replace, C=`);`. Return Value Append → Script Text
   Execute Javascript с Target=BrowserSaved. Белый True Branch из шага 3
   подключить к этому Execute Javascript. JSON вставляется как объект,
   без дополнительных кавычек вокруг B. Переменные для передачи не нужны.
6. Закрытие: `On Console Message (BrowserSaved)` → Branch, Condition от
   Contains (Search In=Message, Substring=`"method":"ui.panel.close"`);
   True → Set Visibility (Target=BrowserSaved, Collapsed).

Проверка: Compile и Save; новая Play-сессия, вход, камера, дождаться результата,
сердце, прокрутить до «Скриншоты». Должна появиться карточка PNG и счётчик 1.
Каждое нажатие сердца повторно получает актуальные материалы владельца.
Проверка нескольких снимков, повторного открытия с ними и просмотра увеличенного
изображения ещё требуется. Print String с Message перед Branch полезен лишь
для диагностики; он не является обязательным звеном передачи данных.
Экспериментальные прогрев, заглушка, Delay и IDEL_SAVED_READY не входят в эту
подтверждённую цепочку; вспышка первого открытия остаётся отдельной проблемой.

Это пошаговый справочник подключения каждой панели. Обновляйте его при добавлении
экранов вместе с [реестром событий](EVENTS.md). Ниже отдельно отмечены работающие
режимы Vue и план подключения; проверка в Unreal пока не выполнена.
Карта локальных и удалённых папок со скриншотами находится в
[PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md). В текущем проекте Unreal
User Widget создан под фактическим именем `/Game/wbp-idelpreview`.

![Виджет входа до начала сессии](preview-login-1920.png)

![Отдельная панель погоды после входа](preview-panel-environment.png)

Эти PNG показывают локальную Vue-сборку, не результат Play.

Сборка поддерживает шесть URL-режимов панелей. Без параметра panel работает полный интерфейс.
Все пути ниже добавляются к вашему абсолютному file URL index.html.
Для актуального архива сначала выполните `npm run build`, затем
`python3 scripts/package_unreal.py ../idel-widget-2026-10-14-client-session.zip`.

| Web Browser | Параметры URL | Размер UMG (при DPI Scale 1) | Положение |
| --- | --- | --- | --- |
| BrowserSession | ?mode=unreal&panel=session | Весь экран | Stretch, offsets 0 |
| BrowserEnvironment | ?mode=unreal&panel=environment | 340 x 340 | Верхний левый угол, X=40 Y=40 |
| BrowserToolbar | ?mode=unreal&panel=toolbar | 340 x 120 | Нижний левый угол, alignment 0,1, X=40 Y=-40 |
| BrowserCompass | ?mode=unreal&panel=compass | 56 x 64 | Верхний правый угол, alignment 1,0, X=-36 Y=32 |
| BrowserSaved | ?mode=unreal&panel=saved | Весь экран | Показывать поверх остальных панелей только при открытии сохранённого; при закрытии `Collapsed` |
| BrowserGallery | ?mode=unreal&panel=gallery | Весь экран | Показывать поверх остальных панелей только при открытии галереи; при закрытии `Collapsed` |

`environment` объединяет название проекта, логотип, время, сезон и погоду.
`toolbar` — нижнее меню действий (домой, информация, камера, скрытие, галерея,
выбор квартир, избранное). «Выбор квартир» — белая кнопка без активного выделения;
нажатие отправляет `ui.apartments`. Изолированный toolbar отправляет
`ui.gallery` и `ui.favorites` для открытия соответствующих Browser; полный
интерфейс открывает их локально. Фильтры квартир открываются только в полном интерфейсе; отдельный URL
для этой панели ещё не реализован. Навигация «Локация / О проекте / …» — другая панель.
Сейчас навигация, фильтры локации, выбор секции/объекта и описание доступны **только в полном
интерфейсе**, а не в четырёх режимах таблицы. План их выделения приведён ниже.

## Подготовка и загрузка каждой панели

1. В текущем IDEL плагин Web Browser уже включён. Для другого проекта включите
   его в Plugins и перезапустите Editor, если он этого требует.
2. Соберите актуальные исходники через `npm run build` в `idel-widget/`.
   Перенесите `index.html`, `build/`, `assets/`, `widget.css`, `session.css`,
   `location.css`, `project.css`, `apartments.css`, `saved.css` в `Content/idel-widget/`.
   Старый архив сам не обновляется.
3. Откройте существующий `/Game/wbp-idelpreview`: пользователь сообщил, что
   `BrowserSession` и `BrowserEnvironment` уже добавлены. Проверьте их фактические
   настройки; остальные Web Browser из таблицы добавляйте по мере подключения.
4. Для каждого браузера задайте размеры, anchors и отступы из таблицы. Включите
   Supports Transparency и Is Variable. Начальную видимость задайте по разделу ниже.
5. Подпишите **каждый** браузер на `On Console Message`, затем вызывайте `Load URL`
   с его URL. В обработчик передавайте также ссылку на браузер-источник.
   В установленной версии плагина проверьте доступность события: если его нет,
   нужен мост/расширение на C++, одной настройки URL для команд недостаточно.
6. Базовый URL формируйте из абсолютного Project Content Directory, например
   `file:///D:/UE_PROJECTS/IDEL/Content/idel-widget/index.html`; добавляйте параметры
   из таблицы. Существование файла по этому адресу в новом месте ещё нужно проверить.
   Для разработки можно использовать `http://127.0.0.1:5175/` с теми же параметрами,
   если Vite запущен на машине Unreal. На другой машине `127.0.0.1` указывает на неё саму.
7. В `BP_CameraPlayerController` уже собрана цепочка `Create Widget → Add to Viewport`
   для `/Game/wbp-idelpreview`. Compile прошёл, но Save Controller завершился ошибкой
   при истёкшем пароле Perforce; после восстановления доступа повторите сохранение.
   Не создавайте второй экземпляр при каждом переходе.
8. Дождитесь `ui.ready` от каждого браузера и передайте ему начальное состояние
   через `Execute Javascript`. При перезагрузке страницы повторите синхронизацию.
   Не заменяйте готовность произвольной задержкой.

`LoadURL`, `ExecuteJavascript` и событие `OnConsoleMessage` описаны в
[API UWebBrowser Epic](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/WebBrowserWidget/UWebBrowser).
Конкретные имена узлов и наличие события сверяйте с версией Unreal в проекте.

У компактных браузеров используйте точечные anchors, не Stretch. На всех
включите Supports Transparency, Is Variable, Visibility=Visible.
Размеры указаны для масштаба браузерного контента 1:1; проверьте проектную DPI
кривую в Play. В изолированных панелях нет мобильных отступов или 4K transform:
позиционирование и масштаб задаются UMG. Компас имеет запас под исходный SVG.

## Иерархия User Widget (`/Game/wbp-idelpreview` в текущем IDEL)

Canvas Panel содержит четыре Web Browser из таблицы. Корневой Canvas и сам
User Widget: Visibility = Not Hit-Testable (Self Only). Браузеры: Visible.
Не ставьте Self & All Children на корень: это отключит кнопки во всех панелях.
В Designer три компактные панели сначала Collapsed, BrowserSession Visible.

## После входа

1. На BrowserSession подпишитесь на On Console Message.
2. Отфильтруйте строки с префиксом IDEL:, разберите JSON и сравните method с session.started.
3. Set Visibility для BrowserSession = Collapsed (обязательно в UMG).
4. Set Visibility для трёх компактных браузеров = Visible.
5. Set Input Mode Game and UI для вашего Player Controller, Widget to Focus не задавайте,
   Hide Cursor During Capture=false; Show Mouse Cursor=true.
6. Set Focus to Game Viewport, чтобы клавиатура не оставалась в поле телефона.

После входа Vue в panel=session скрывает содержимое и отправляет session.started,
но сам прямоугольник Web Browser продолжает ловить мышь, пока Blueprint не установит
Collapsed. Только перенос файлов не исправляет полноэкранный hit testing.

Для диагностики без настройки события можно поставить BrowserSession Collapsed,
а три компактных браузера Visible сразу в Designer. Тогда Play сразу покажет
панели и позволит проверить камеру вне их прямоугольников, пропустив мок-вход.

## Команды и синхронизация

В каждой панели сохранены IDEL-команды и window.IdelWidget.setState/getState.
ui.ready содержит params.panel. Подключайте On Console Message каждого браузера
к общему обработчику команд. Состояние хранится в отдельных экземплярах Vue:
автоматического обмена между браузерами нет.
Реальный токен входа остаётся только в BrowserSession. Текущая схема отдельных
панелей не переносит его к Browser-владельцу квартир, поэтому серверное избранное
в ней пока не включайте. Не добавляйте токен в `session.started` или консольный мост.

На ui.toggleVisibility обработчик Blueprint должен вызвать Execute Javascript
на BrowserEnvironment и BrowserCompass:

```js
window.IdelWidget.setState({hidden: true});
```

Для возврата используйте hidden:false. На BrowserToolbar кнопку скрытия оставьте
доступной: она сама переключает собственное состояние и позволяет вернуть панели.
Чтобы скрытые Environment/Compass не перехватывали мышь, дополнительно меняйте
их UMG Visibility на Collapsed/Visible. Не сворачивайте BrowserToolbar целиком.

При выходе из сессии сверните компактные панели, покажите BrowserSession,
вызовите у него window.IdelSession.reset(), восстановите состояния остальных
панелей через setState({hidden:false}) и нужный режим ввода для входа.

## Проверка в Play

- Вход менеджером и гостем сворачивает именно BrowserSession.
- Над центральной частью сцены работают вращение, перемещение и колесо камеры.
- Над кнопками работают нажатия; они не запускают действие камеры одновременно.
- После клика по панели и возврата к сцене мышь снова управляет камерой.
- Нижняя кнопка скрытия может вернуть интерфейс.

Браузерные тесты подтверждают размеры и события, но итоговую передачу ввода
необходимо проверить в Unreal после перестройки UMG.

## Что подключать в каждой готовой панели

| Панель | Команды из Vue | Действие Unreal и обратное состояние |
| --- | --- | --- |
| BrowserSession | `session.started` | Свернуть полноэкранный браузер после успешного входа, показать компактные панели. Текущий `index.html` включает реальный API по HTTP. Команда содержит `client:{id}` и менеджера, но не телефон, ФИО клиента или токен. |
| BrowserEnvironment | `scene.setTime`, `scene.setSeason`, `scene.setWeather` | Вызвать реальные функции времени/сезона/погоды вашей сцены; сохранить значения `minutes`, `season`, `weather`. При изменении сцены другим способом вернуть значения через `setState`. |
| BrowserToolbar | `scene.home`, `scene.screenshot`, `ui.info`, `ui.toggleVisibility`, `ui.apartments`, `ui.gallery`, `ui.favorites` | Направить в соответствующие обработчики камеры/UI. В изолированном toolbar `ui.gallery` и `ui.favorites` открывают отдельные Browser; в полном интерфейсе переходы локальные. `ui.info` переключает `home → location`, из другого раздела возвращает `home`. |
| BrowserCompass | `scene.resetNorth` | Вызвать реальный поворот камеры на север. Передача текущего угла камеры в компас пока не реализована. |

Точные параметры всех команд приведены в [EVENTS.md](EVENTS.md).
BrowserSession содержит оба шага входа в одном URL: сначала телефон, для нового
клиента затем ФИО, менеджер и согласие. Источник данных — `/api/session`,
`/api/managers`, `/api/session/register`. Ответ о необходимости регистрации
не сворачивает браузер. На втором шаге телефон заблокирован; «Назад» возвращает
первый шаг. Ссылка согласия появится после настройки `IdelConfig.consentUrl`.
Для автономного превью задайте `IdelConfig.realSession=false` до `build/app.js`.
При загрузке из `file://` сервер принимает Origin `null` по отдельному разрешению пользователя;
HTTP сам по себе не отменяет проверку Origin. Проверка нового входа в Play
и packaged build остаётся отдельным этапом.
Например, начальное состояние BrowserEnvironment:

```js
window.IdelWidget.setState({minutes: 720, season: 'summer', weather: 'clear'});
```

Этот вызов меняет только UI. Он не отправляет команду назад и не меняет погоду
в Unreal: функции сцены нужно вызывать в Blueprint отдельно.

## Общее состояние между браузерами

Предлагаемая схема Blueprint (ещё не подтверждена в проекте): хранить состояние
презентации в одном владельце — например, `WBP_IdelPreview`. Названия обработчиков
ниже рекомендуемые, это не уже существующие функции ассета.

1. `HandleIdelCommand(Browser, Message)`: пропустить строки без `IDEL:` и
   диагностические `IDEL:DEBUG`; удалить префикс, разобрать JSON, проверить `method`
   и `params`. Неверный JSON игнорировать, не выполнять как JavaScript.
2. На `ui.ready` отметить браузер готовым и вызвать `SyncPresentationState` для него.
   Если состояние изменилось до готовности, отправить актуальный снимок после `ui.ready`.
3. На пользовательскую команду обновить общее состояние, вызвать нужное действие
   сцены и передать изменённые поля готовым браузерам через `setState`.
4. Владелец хранит как минимум `view`, `projectTarget`, `chapterTargets`, `categories`, `hidden`,
   `minutes`, `season`, `weather`. Для `ui.info` вычислять переход из общего `view`,
   поскольку в самой команде параметры пустые; синхронизировать также BrowserToolbar.
5. Формировать аргумент `setState` JSON-сериализатором. Не вставлять текст из API
   конкатенацией в JS-строку: кавычки и переносы должны экранироваться автоматически.

`getState()` возвращает значение внутри JS страницы, но `Execute Javascript` не
возвращает его в Blueprint. Для текущей схемы используйте команды и общее состояние
в Unreal; отдельного запроса состояния с ответом через мост сейчас нет.

## Как сейчас показать информацию о секции

Описание уже сверстано в `ProjectDescription.vue`, данные находятся в
`src/data/project.js`. В полном интерфейсе выбор кнопки секции меняет описание под
погодой и отправляет `scene.selectProjectTarget` с `params.target`.

Для **визуальной проверки полного интерфейса** в Unreal:

1. Откройте отдельный тестовый Web Browser на `index.html?mode=unreal`, без `panel`.
2. Пройдите мок-вход. Параметр `?view=project` в режиме Unreal вход не пропускает.
3. Вызовите `Execute Javascript` на этом же браузере:

```js
window.IdelWidget.setState({view: 'project', projectTarget: 'section-2'});
```

4. Покажется заголовок секции 2; абзацы загрузятся из API, если редактор их заполнил.
   Аналогично доступны `section-1`…`section-8`, `business-center`, `parking`, `storage`.
   Неизвестный target игнорируется.

Вызов на BrowserEnvironment **не покажет описание**: его шаблон пока не содержит
этот блок. Передача `description` в `setState` также пока не поддерживается.
Полноэкранный браузер используйте здесь для проверки вида: прозрачные участки
не обеспечивают управление 3D-сценой мышью.

### Отдельные описание и навигация — следующий этап реализации

Ниже план, а не работающие URL. Не используйте `panel=navigation` или
`panel=description` сейчас: неизвестный `panel` открывает полный интерфейс.

| Предлагаемый браузер | Содержимое | Размещение и показ | Что ещё реализовать |
| --- | --- | --- | --- |
| BrowserNavigation | Навигация по главам; над ней фильтры локации либо выбор секции/объекта | Низ по центру, стартовый размер 910 × 180 при DPI 1, отступ снизу 40; показывать для всех глав, кроме `home` | Отдельный режим `panel=navigation`, компактные стили, отображение нужного ряда по `view`, проверка пересечений с меню на малых экранах |
| BrowserDescription | Заголовок и абзацы выбранного объекта | Слева под BrowserEnvironment; ориентир ширины 297, высоты 280 с прокруткой; показывать для `project`, `architecture`, `park`, `courtyard`, `entrance` | Отдельный режим `panel=description`, компактные стили, обработка пустого текста и длинного описания |

Размеры новых панелей — начальные ориентиры, их ещё нужно проверить в браузере
и Play. Положение описания считать от нижней границы Environment плюс отступ,
чтобы прямоугольники Web Browser не перекрывались.

После реализации этих режимов подключение будет следующим:

1. Добавить два браузера в тот же Canvas, задать их URL и подключить к общему
   `HandleIdelCommand`, дождаться `ui.ready` и синхронизировать состояние.
2. На `ui.selectChapter {chapter:'project'}` записать `view:'project'`, показать
   навигацию с выбором секции и описание. При `location` скрыть описание и показать
   фильтры; при `home` свернуть обе новые панели.
3. На `scene.selectProjectTarget {target:'section-2'}` сохранить выбранный target,
   вызвать в Unreal найденную функцию выбора/камеры секции и передать
   `{view:'project', projectTarget:'section-2'}` обеим панелям. Повторное нажатие
   уже выбранной кнопки в текущем Vue не отправляет событие.
4. Если пользователь выбирает секцию кликом по зданию в Unreal, выполнить ту же
   синхронизацию из Blueprint. Точки, выделение здания и 3D-камера остаются в Unreal.
5. При скрытии UI сворачивать также новые браузеры. При возврате показывать
   описание только для пяти разделов с объектами (не `home` и не `location`). Toolbar оставлять доступным.

Это схема будущего подключения, а не подтверждённая цепочка в Blueprint.
Соответствие `section-2` конкретному Actor и числовому ID backend нужно определить
отдельно; строковый `target` из API не является числовым ID раздела Bitrix.

### Откуда брать настоящий текст

Сейчас описание меняется по локальному справочнику. Требования к backend сохранены
в [API_BACKLOG.md, API-01](../idel-backend/docs/API_BACKLOG.md): источник текста,
планируемый endpoint секций, поля ответа и файлы backend для изменения.
Endpoint и загрузка описаний во Vue пока не реализованы.

При подключении API нужно согласовать связь ID секции с target сцены, загрузить
текст выбранной секции и отобразить его в BrowserDescription. Если данные передаёт
Unreal, сначала потребуется расширить JS-контракт для текстовых данных; текущий
`setState` принимает только выбор объекта. Если API вызывает Vue, нужно отдельно
реализовать загрузку и состояния ожидания/пустого ответа. Эти два варианта пока
не выбраны; не добавляйте вызов несуществующего метода в Blueprint.

## Подключение экранов 07–10 после их вёрстки

Экраны работают в полном Vue-интерфейсе. Новых отдельных `panel`-режимов это
изменение не добавляет; BrowserEnvironment по-прежнему не выводит описание.
Для визуальной проверки используйте полный браузер `?mode=unreal`, пройдите
мок-вход и затем вызовите на нём:

```js
window.IdelWidget.setState({
  view: 'entrance',
  chapterTargets: {entrance: 'playroom'}
});
```

1. В общий снимок состояния Unreal добавьте `chapterTargets`: `architecture:
   pilasters`, `park: bratva`, `courtyard: fish-art`, `entrance: playroom`.
   Это начальные ключи выбора; при выходе из сессии восстановите их.
2. Обработчик `ui.selectChapter` должен принимать все шесть глав. Для четырёх
   новых глав открывайте соответствующий вид сцены и восстанавливайте сохранённый
   объект. Переход сам по себе не отправляет `scene.selectChapterTarget`.
3. На `scene.selectChapterTarget` прочитайте `params.chapter` и `params.target`,
   найдите Actor/ракурс по этой паре, сохраните выбор и отправьте обновление UI.
   Например, для колонн: `setState({view:'architecture',
   chapterTargets:{architecture:'columns'}})`.
4. Если выбор сделан в 3D, отправьте такое же обновление из Unreal. Оно обновит
   кнопку и описание без повторного события. Остальные главы сохраняют выбор.
5. Для МОПов подключите `scene.requestInteriorView {target}` от кнопки «Вид»
   к реальному обработчику ракурса помещения. В Vue она пока только отправляет
   запрос: выпадающего списка видов/этажей и смены камеры в браузере нет.
6. После выделения BrowserNavigation/BrowserDescription передавайте им один
   снимок. Описание показывайте во всех пяти разделах с объектами, скрывайте на
   `location` и `home`; переключатель «Вид» нужен только в МОПах. При расчёте
   области описания предусмотрите место справа под кнопку «Вид» (в полном UI
   она высотой 48 px, с отступом 5 px от описания при масштабе 1).

Точки и подписи в сцене, камера и соответствие ключей Actor остаются задачами
Unreal. Ключи всех 19 кнопок перечислены по группам в [EVENTS.md](EVENTS.md).
Названия, подписи помещений и абзацы загружаются из `/api/presentation/objects`;
при пустом `description` Vue показывает сообщение об отсутствии описания.
Шаги выше описывают ожидаемое подключение, а не выполненную проверку в Play.

## Проверка после добавления каждой панели

- URL действительно открывает одну нужную панель, без второго экрана входа.
- `ui.ready` сообщает ожидаемый panel; команды приходят с правильными параметрами.
- После reload браузер получает актуальное состояние, а не сбрасывает выбор соседних панелей.
- Выбор секции кнопкой и выбор здания в 3D приводят к одному описанию и выделению.
- В состоянии home/при скрытом интерфейсе невидимые панели имеют UMG `Collapsed`.
- В Play проверены камера вне панелей, клики внутри, DPI и отсутствие перекрытий.
- В packaged build отдельно проверены загрузка локальных файлов и мост событий.

Различие `Collapsed`, `HitTestInvisible` и `SelfHitTestInvisible` описано в
[документации Epic по EVisibility](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/SlateCore/EVisibility).
Фиксируйте результаты отдельно в [TODO.md](../TODO.md): «Vue», «браузер», «Unreal».

## Квартиры: подключение экранов 11–13

Реализованы Vue-компоненты фильтров, выбранной квартиры, снимка и подробной
карточки. **Пока они отображаются только в полном интерфейсе без `panel`**;
отдельные URL `panel=apartmentFilters` и подобные не реализованы. Существующие
`environment`, `toolbar`, `compass`, `session` сохраняют прежние размеры.
Нажатие квартир в отдельном toolbar передаст команду, но не создаст другой UMG
Browser автоматически. Перед подключением к рабочей схеме из четырёх браузеров
нужно выделить новые panel-режимы и реализовать их синхронизацию.

Ориентиры полного макета при 1920×1080 (при 3840×2160 масштаб ×2):

| Блок | Vue-компонент | Размещение |
| --- | --- | --- |
| Фильтры | ApartmentFilters | В общей верхней колонке под погодой, ширина около 297, высота до 546; содержимое прокручивается. |
| Квартира | ApartmentCard | Справа 40, сверху 128, ширина 227; снимок появляется ниже в той же колонке. |
| Секции и статусы | ApartmentSceneControls | Снизу по центру и справа; общий нижний toolbar остаётся слева. |
| Этажи | ApartmentFloors внутри ApartmentSceneControls | Вертикальная панель рядом с фильтрами; по клику на этаж отправляет `scene.apartments.floor`. Выбор секции до появления панели — в центре. |
| Подробнее | ApartmentDetails | Модальный слой на весь экран; перехватывает ввод до закрытия. |
| Список, экран 20 | ApartmentList внутри ApartmentSceneControls | Панель слева 503, сверху 40, 1223×1000; сетка 5×2 карточки, пагинация внизу. При 3840×2160 размеры и отступы удваиваются. Правая карточка, секции и легенда статусов скрыты. |

Для будущего разделения выделите BrowserApartmentFilters, BrowserApartmentCard,
BrowserApartmentNavigation и полноэкранный BrowserApartmentDetails. Каждый
должен получить реализованный URL-режим и компактную область UMG. Невидимые
Browser переводите в Collapsed, особенно модальное окно. Прозрачный полноэкранный
Web Browser всё равно перекрывает ввод сцены: полный интерфейс удобен для
проверки, но сам по себе не решает передачу кликов к фасаду.

### Последовательность подключения к сцене

1. Загрузите актуальные `index.html`, `build/app.js`, все CSS и assets. Для каталога
   задайте `window.IdelConfig` **до** app.js (см. README). Проверьте CORS и доступ
   к планировкам из Web Browser. Локальный Vite proxy не входит в production.
2. После `ui.ready` зарегистрируйте приём сообщений `IDEL:` по существующей схеме.
   Выберите один экземпляр-владелец состояния квартир; у разных Browser отдельные
   запросы и revision. Не транслируйте события всех копий в камеру одновременно.
3. На `ui.apartments` откройте нужные UMG-панели. На `scene.apartments.query`
   запомните revision, снимите старую подсветку, отмените предыдущий переход и
   переведите камеру к нужному фасаду. Конкретный Camera Actor/Blueprint пока
   нужно определить в проекте, имена не выдумываем.
4. В момент завершения перехода выполните в Browser-владельце:
   `window.IdelApartments.sceneReady({revision: N})`. N берите из команды, а не
   фиксируйте числом в Blueprint. При фильтрации без движения камеры можно
   подтвердить готовность сразу. Vue дождётся также загрузки всех страниц API.
5. На `scene.apartments.highlight` найдите Actor квартиры по sceneObjectKey либо
   таблице ID→Actor, примените цвета комнатности/статуса. Не используйте номер
   квартиры как глобальный ID. Проверенные записи API пока имеют null в
   sceneObjectKey — привязку к Actor проверить в Unreal; текущий API
   выдаёт вычисленный ключ квартиры, но Blueprint ещё не проверен.
6. При клике на полигон квартиры в Unreal усилите её подсветку и выполните
   `window.IdelApartments.select({id: 680})` (пример ID, подставить выбранный).
   Vue запросит GET properties/apartment/{id} и откроет правую карточку.
   Обратный выбор из списка приходит как scene.apartments.select; null снимает
   выделение. Повторной команды после вызова select из Unreal не будет.
7. На scene.screenshot сохраните captureId, создайте реальный снимок сцены и
   верните `window.IdelApartments.setScreenshot({captureId: '...', url: '...'})`.
   Передавайте JSON через корректную сериализацию, не вставляйте путь строковой
   склейкой. При ошибке верните `{captureId,error:true}`. Желательно снимать
   сцену без интерфейса. Каждый подтверждённый снимок попадает в историю
   текущей сессии. Снимок можно запросить вне квартир с `propertyId:null`.
   Старый снимок не появится под другой квартирой.
8. Подробнее открывается во Vue. При ui.apartment.details блокируйте управление
   сценой; при ui.apartment.details.close возвращайте его. Тур вызывается
   `scene.apartment.tour` с ID квартиры. «Вид из окна» теперь открывает отдельный
   Vue-оверлей поверх сцены: `scene.apartment.window {id,sceneObjectKey,viewIndex}`
   выбирает ракурс 1–3 (начальный 2), `scene.apartment.window.pan` поворачивает
   взгляд, `scene.apartment.window.close` возвращает предыдущую камеру. В Unreal
   отметьте видовые точки на самой 3D-сцене; Vue их не рисует. Компас внутри
   оверлея отправляет обычный `scene.resetNorth`. При программной смене ракурса
   можно вызвать `IdelWidget.setState({apartments:{windowViewIndex:1}})` без эха.
   Пока API не отдаёт список реальных ракурсов квартиры: это задача API-03;
   картинки панорамы в браузерном превью — только материалы макета.
9. На ui.apartments.close отмените незавершённые переходы, уберите подсветку и
   скройте связанные панели. При смене фильтра игнорируйте результаты старой
   revision. Ошибка API не должна оставлять старую подсветку.
10. В режиме «Этажи» после `scene.apartments.results` обработайте
    `scene.apartments.floor {revision,sectionId,floor,items}`: переведите
    камеру к срезу этажа и подсветите только его квартиры. Конкретные Camera
    Actor и Blueprint-цепочки ещё не подтверждены в Play.
11. Для серверного избранного после настоящей авторизации передайте session
    token через setSessionToken в нужные экземпляры. Моковый вход создаёт только
    локальное избранное. Не записывайте token в логи или getState; endpoint
    требует HTTPS.

Режим «Списком» сейчас включается `scene.apartments.mode {mode:'list'}` только
в полном Browser, без отдельного URL `panel=apartmentList`. Крестик большой
панели вызывает тот же метод с `mode:'facade'`; нижняя кнопка выхода закрывает
весь выбор квартир через `ui.apartments.close`. 10 карточек и номер страницы
вычисляются в Vue из уже загруженных `GET /api/properties` результатов; пагинация
не меняет состояние Unreal. Планировка берётся из `apartment.planImage`, цена,
секция, этаж, ипотека и срок сдачи — из каталога. «Подробнее» запрашивает
`GET /api/properties/apartment/{id}`, затем открывает ApartmentDetails. При
выборе карточки передаётся `scene.apartments.select`; тур и вид из окна сначала
выбирают ID квартиры, затем отправляют свою команду. Избранное пишет в API только
при реальном HTTPS-токене; иначе хранится в памяти текущей сессии. Машиноместа и кладовые в заголовке пока отключены.
Для отдельного BrowserApartmentList в UMG потребуется собственный panel URL,
обратная синхронизация `mode/filters` и проверка передачи мыши в Play; это ещё
не реализовано.

Реестр параметров — [EVENTS.md](EVENTS.md), §9. Проверки в Play и packaged build,
точные Camera Actor, материалы подсветки и цепочки Blueprint ещё предстоят.

## Галерея, сохранённое и конец сессии — Vue 29.09.2026

Реализованы самостоятельные `?mode=unreal&panel=saved` и
`?mode=unreal&panel=gallery`. Их Web Browser занимают весь экран как временные
оверлеи; сама панель расположена в X≈503, Y=40, размер 1223×1000 при
1920×1080, при 4K масштаб ×2. В обычном полном Browser те же экраны доступны
через `?view=saved|gallery` для предпросмотра. Отдельного `panel=exit` нет:
диалог выхода вызывается в полном Browser.

13.10.2026: в `panel=saved` HTML скрывает `#app` до запуска Vue; Vue ждёт
загрузки шрифтов, размера окна больше 1×1 и трёх стабильных кадров разметки.
Подготовка повторяется при `setState({view:'saved'})` и изменении размера окна.
Для открытия в UMG: `BrowserSaved Visible` → Execute Javascript (Target BrowserSaved)
`window.IdelWidget.setState({view:'saved',hidden:false});`. Render Opacity браузера
должна быть 1; экспериментальные Delay, `IDEL_SAVED_READY` и Blueprint-переключения
Opacity больше не нужны. Закрытие: `ui.panel.close` → Collapsed. Устранение
вспышки этой сборкой в Unreal ещё требует проверки; события подготовки наружу нет.

| Компонент | Источник и событие | Видимость / обратное состояние |
| --- | --- | --- |
| GalleryPanel | По умолчанию 25 локальных изображений Figma из `assets/gallery`; при `IdelConfig.galleryApi=true` и `galleryComplexId` запрашивает будущий API-05. Кнопки сетки/стрелки локальные, команд Unreal нет. | Открывается в `panel=gallery` сразу; просмотр поверх всего экрана. Закрытие отправляет `ui.panel.close {panel:'gallery'}`. API-режим показывает загрузку, ошибку/повтор и пустое состояние; живой backend ещё не проверен. |
| SavedPanel | `IdelApartments.getMaterials()` в Browser-владельце, затем `setMaterials(...)` в BrowserSaved. | Открывается в `panel=saved` сразу. `ui.saved.openApartment`, `ui.saved.toggleFavorite` и `ui.saved.removeScreenshot` нужно переслать владельцу; закрытие отправляет `ui.panel.close {panel:'saved'}`. |
| Диалоги отправки | Макетные email/Telegram/MAX; провайдеров и серверного маршрута пока нет. | Кнопка отправки отключена; не считать это доставкой, QR или созданием PDF. |
| Завершение сессии | Кнопка справа внизу, `session.ended` после успешного выхода. | При «Сохранить избранное и выйти» пишет в IndexedDB только избранное; если запись не удалась, оставляет сессию открытой. При «Выйти без сохранения» очищает данные. В Unreal после `session.ended` нужно удалить PNG сессии, скрыть presentation Browser и показать стартовый. |

Пошагово для отдельных Browser: (1) скопировать свежие `saved.css`,
`assets/gallery`, `build/app.js` и добавить BrowserSaved/BrowserGallery с URL
из таблицы, начальное UMG Visibility=`Collapsed`; (2) в BrowserToolbar на
`ui.favorites` показать BrowserSaved, на `ui.gallery` — BrowserGallery;
(3) получить JSON из `IdelApartments.getMaterials()` Browser-владельца и
передать его BrowserSaved через `IdelApartments.setMaterials(...)` или
`IdelWidget.setState({materials:...})` **до** показа; повторять после изменения
избранного/снимков; (4) команды `ui.saved.*` применить в Browser-владельце и
затем снова синхронизировать; (5) на `ui.panel.close` перевести соответствующий
Browser в `Collapsed`; (6) на `session.ended` скрыть презентационные Browser и
показать стартовый. В full Browser переходы галереи/сохранённого локальные,
`ui.gallery`/`ui.favorites` не отправляются.

Камера в изолированном BrowserToolbar отправляет `scene.screenshot` с
`captureId`. В Play проверена цепочка `wbp-idelpreview.HandleScreenshotCommand`
→ `Shot`: PNG появляется в `Saved/Screenshots` без интерфейса. Для анимации
и списка нужно после готовности PNG вызвать в **BrowserToolbar**
`IdelApartments.setScreenshot({captureId,url})`: камера сама уже вызвала
`beginCapture`. После принятого ответа миниатюра летит к сердцу; затем
обновите BrowserSaved через `setMaterials`. Если владельцем материалов служит
другой Browser, сначала вызовите там `beginCapture({captureId})`, а ответ
верните в тот же Browser. Нельзя считать файл готовым сразу после отправки
команды `Shot`: ей нужен достоверный путь и признак завершения записи.

Снимки существуют только до конца сессии. Новые локальные архивы IndexedDB
сохраняют избранные объекты без снимков. Unreal должен вести список созданных
в этой сессии PNG и удалить именно их после `session.ended`, в том числе при
выходе без сохранения. Передача URL в Vue, синхронизация BrowserSaved и
удаление PNG ещё не проверены в Play и packaged build.

`IdelSession.listArchives/getArchive/deleteArchive` доступны только в том же
профиле Web Browser. Архив не содержит телефон и не передаётся клиенту.
`setMaterials` копирует данные только в конкретный Browser; он не создаёт
серверный архив и не синхронизирует экземпляры автоматически. Серверная
сессия, снимки, PDF, QR и доставка требуют API-04; до реализации и настройки
почты/ботов сценарий нельзя считать подключённым.

## Обновлённые GET-запросы контента, 28.09.2026

В полном Vue-интерфейсе при открытии главы запрос выполняется один раз и
кэшируется до перезагрузки страницы. Для `project` параллельно загружаются
`GET /api/sections` и `GET /api/presentation/objects?chapter=project`;
для остальных глав — `GET /api/presentation/objects?chapter=architecture|park|courtyard|entrance`.
Кнопки и описания сопоставляются по стабильному `target`, а не по позиции в
списке или отображаемому имени. Данные пустого `description:[]` не заменяются
макетным текстом. При сетевой ошибке доступны статические подписи кнопок и
кнопка повтора; неуспешный запрос не отмечается готовым.

Квартирный каталог использует `GET /api/properties/filters?type=apartment`,
страницы `GET /api/properties?type=apartment&status[]=...&page=...&limit=100`
и `GET /api/properties/apartment/{id}`. `residentialComplex` не передаётся.
Для Unreal без изменения остаются команды `scene.selectProjectTarget` и
`scene.selectChapterTarget` с параметром `target`; числовые ID секций/объектов
из API не являются Actor ID. Отдельные Browser для контента не созданы.

Ползунок времени отправляет `scene.setTime` на каждом `input` во время перемещения;
`params.minutes` — 0–1439, `params.hours` — minutes / 60. Обработчик Unreal должен
принимать последовательность значений до отпускания мыши. Пользователь подтвердил
приём команды прежней версии; непрерывная отправка новой версии в Play ещё не проверена.
Для BrowserEnvironment пользователь проверил высоту UMG 400: нижний ряд больше не обрезается.

### Структура секция → этаж — 13.10.2026

Переключатель ApartmentSceneControls выбирает секции из `options.section`.
ApartmentFloors требует выбрать секцию и показывает её этажи. В API нет
фильтра/метаданных корпуса. Передайте `sectionId` из `scene.apartments.floor`
в актуальный механизм выбора этажа Unreal; не читайте прежний `buildingId`.
Геометрия существующих UMG-панелей и их URL не менялись. Blueprint-подключение
нового параметра не проверено; браузерная проверка не подтверждает Play.
