# BrowserSession — общее хранилище данных

Актуальное уточнение 16.10.2026: общий кэш сохраняется, но выбор точки не восстанавливается. Начальные projectTarget/chapterTargets пустые (null); при смене главы выбор сбрасывается, описание передаётся с visible=false до нового клика. Старые записи ниже о сохранённом выборе относятся к прежней версии. Сброс выбора не очищает данные API и не выполняет повторные HTTP-запросы.

## Подтверждение в Play — 16.10.2026

Получение объектов в BrowserNavigation подтверждено присланным логом Play: после data.response для sections и presentation/objects?chapter=project выбор section-3 отправил ui.presentation.description с title=Секция 3, description=[26 этажей,264 квартиры,...], visible=true; section-4 — 26 этажей,203 квартиры и площади. Это данные API, дошедшие до Navigation, а не только ответ владельца. Для объектов architecture в том же логе есть пустые description и visible=false: получение непустых текстов этой главы этим не подтверждено. BrowserDescription и движение камеры пока отдельно не подключены/не подтверждены.

Следующий скриншот пользователя подтвердил открытие BrowserNavigation кнопкой информации: видны ряд категорий Локации и шесть глав. Initial URL исправлен с ошибочного `panel=panel=navigation` на `file:///D:/UE_PROJECTS/IDEL/Content/idel-widget/index.html?mode=unreal&panel=navigation`. В BrowserToolbar проверка Contains Message `"method":"ui.info"` → Branch True → Set Visibility Target=BrowserNavigation, Visible. Это пока только открытие: ряд категорий локальный, загрузка объектов API, переключение/скрытие и синхронизация состояния этим скриншотом не подтверждены.

Скриншот пользователя подтверждает в wbp-idelpreview полный круг BrowserToolbar → BrowserSession → BrowserToolbar: CACHE_TEST_START, CACHE_TEST_JS: object, IDEL data.request с path=managers, CACHE_TEST_OK: managers=3. Это подтверждает получение ответа после входа; полнота очереди, большие ответы, offline, остальные панели и packaged build этим тестом не проверены. Более ранние пометки ниже о непроверенном Unreal относятся к состоянию до этого теста.

Воспроизведение: на BrowserToolbar On Console Message → Branch с Contains Message `"method":"data.request"` → Execute Javascript Target=BrowserSession. Script Text: Append A=`window.IdelData.handleRequest((`, B=Message после Replace From=`IDEL:` To=пусто, C=`).params);`. На BrowserSession в цепочке False после session.started/session.ended — Branch с Contains Message `"method":"data.response"` → Execute Javascript Target=BrowserToolbar. Append A=`window.IdelData.receive((`, B=Message именно BrowserSession после такого же Replace, C=`).params);`. Существующие цепочки сохранены.

Диагностика: после IsVisibleStarterWidgets в session.started временный Execute Javascript Target=BrowserToolbar, Script Text=`console.log('CACHE_TEST_JS: ' + typeof window.IdelData); if(window.IdelData){window.IdelData.read('managers').then(function(data){console.log('CACHE_TEST_OK: managers=' + data.items.length);}).catch(function(error){console.log('CACHE_TEST_ERROR: ' + error.message);});}`. Перед ним временный Print String CACHE_TEST_START. Для просмотра console.log перед первым Branch события BrowserToolbar временно вставлен Print String: In String=Message, Print to Log=true, Print to Screen=false. Без этой передачи сообщения console.log не были видны в Output Log. После проверки диагностические узлы и тестовый вызов можно удалить, сохранив обе рабочие ветки обмена. Это дополнение внесено после упаковки архива session-cache; runtime не менялся.

Проверка 16.10.2026: build, session-cache.test.mjs, data-hub.test.cjs, npm test, panels.test.cjs и presentation-panels.test.cjs прошли. Проверены offline после прогрева, обмен частями и сохранение общего кэша при logout. Скриншоты навигации/описания осмотрены. При первых запусках были тайм-ауты Chrome load/reload; повтор обязательных проверок прошёл, новым тестам задано ожидание DOMContentLoaded. Первая сборка остановилась на Unexpected EOF чтения session.js; фактические исходники прошли синтаксическую проверку и повторную сборку. Дополнительный project.test.cjs остановился на тайм-ауте открытия страницы; chapters/location в той команде не запускались. Проверки в реальном Unreal ещё не выполнены.

Версия: 16.10.2026. Реализовано в Vue; подключение нового обмена в Unreal и packaged build ещё не подтверждены. Эта инструкция заменяет прямые запросы API из отдельных панелей, описанные в прежних разделах PANELS.md.

## Запуск и срок жизни

`index.html?mode=unreal&panel=session` создаёт владельца `window.IdelData` и начинает загрузку сразу при запуске страницы, до входа пользователя. BrowserSession создаётся один раз при запуске игры. После входа его можно Collapsed, но нельзя уничтожать, перезагружать URL или пересоздавать: данные хранятся в памяти JavaScript этого браузера. Влияние Collapsed на доставку Execute Javascript нужно проверить в Play.

Очередь: менеджеры → главы презентации → секции → объекты глав project, architecture, park, courtyard, entrance, location → фильтры и полный каталог apartment, parking, storage. Страницы каталога загружаются последовательно по 100, включая available/reserved/sold; частичный каталог не публикуется. При включённом IdelConfig.galleryApi добавляется галерея. Кэш содержит JSON и ссылки на изображения, сами изображения отдельно не скачиваются. Клиенты, авторизация, материалы и избранное пользователя в общий кэш не входят.

Ошибка/тайм-аут задачи не останавливает очередь. Индикатор стартового экрана показывает готовность; кнопка повтора повторяет неудачные задачи. API владельца: `IdelData.getStatus()`, `IdelData.retry()`, `IdelData.read(path)`. Повторный start не загружает успешные данные заново. `IdelSession.reset({save:false})` очищает личную сессию, но не общий кэш. После перезапуска BrowserSession нужен интернет; localStorage/диск здесь не используются.

## Обязательная маршрутизация Blueprint

Все отдельные панели по умолчанию используют хранилище. Без следующих проводов данные в них не загрузятся. `?data=standalone` или `IdelConfig.dataMode='standalone'` предназначены для самостоятельного браузерного просмотра и прежних тестов, при них панель делает свои запросы.

1. В `wbp-idelpreview` для On Console Message каждого браузера-потребителя (Navigation, Toolbar, Saved, Gallery и других используемых панелей) распознавать метод `data.request`. Событие имеет обычный префикс `IDEL:`. После Replace (Source String=Message, From=`IDEL:`, To=пусто) получается полный JSON сообщения. Собрать Append: A=`window.IdelData.handleRequest((`, B=очищенный JSON, C=`).params);`. Белый провод True соответствующего Branch → Execute Javascript; Target=BrowserSession, Script Text=Append Return Value. Не разбирать и не менять вложенные строки вручную.
2. В On Console Message (BrowserSession) распознавать `data.response`. Тот же Replace и Append: A=`window.IdelData.receive((`, B=очищенный полный JSON, C=`).params);`. Белыми проводами выполнить этот Script Text на всех браузерах-потребителях. Чужой requestId они игнорируют. Не отправлять обратно в BrowserSession.
3. Сохранить существующую обработку session.started/session.ended. Новые ветки должны стоять в цепочке False прежних Branch или отдельной Sequence; нельзя оторвать старую цепочку. Не пересылать `data.response` в HandleScreenshotCommand/JSON материалов. `data.cache.status` — только публичный прогресс, отдельной маршрутизации не требует.

`data.request.params={requestId,path}`. Ответ разбит на части `data.response.params={requestId,index,total,chunk}` по максимум 8000 символов. Передавать **каждую** часть без обрезки; получатель собирает их, допускает другой порядок и повторы. В Unreal нельзя вставлять chunk как сырой JS: приведённая обёртка передаёт весь исходный JSON с его экранированием. Потребитель повторяет запрос с тем же ID каждые 2 секунды до ответа, максимум 120 секунд. Владелец принимает только разрешённые публичные ресурсы. Токены и личные данные через этот канал не отправляются.

## Навигация и текст описания

BrowserNavigation (`panel=navigation`, 910×180, низ по центру) получает наборы объектов через этот канал. BrowserDescription (`panel=description`, 297×280, слева под окружением) больше не запрашивает описание самостоятельно.

При выборе объекта Navigation отправляет `ui.presentation.description` с `{title,description,room,visible,view,target}`. `description` — массив абзацев. Передать params в BrowserDescription:

```js
window.IdelWidget.setState({view:'project',title:'Секция 4',description:['Первый абзац','Второй абзац'],target:'section-4',visible:true});
```

Blueprint должен установить BrowserDescription Visible при visible=true, Collapsed при false. Пустое описание даёт visible=false; прозрачная пустая страница сама не пропускает ввод в сцену. Синхронизацию `ui.presentation.state` с другими панелями сохранить.

При клике существующей дизайнерской точки уже выполняется её переход камеры. После него вызвать на BrowserNavigation:

```js
window.IdelWidget.selectObject({chapter:'project',target:'section-4'});
// Вместо target допустим id элемента API:
// window.IdelWidget.selectObject({chapter:'project',id:1721});
```

Метод выбирает объект из общего набора и отправляет состояние/текст, но повторно не запускает камеру. При выборе кнопки самой Navigation событие scene.requestPresentationCamera по-прежнему использует камеру раздела или элемента API. Конкретные имена Blueprint дизайнерских точек и функции камеры ещё не сверены.

## Проверка после подключения

Запустить игру с интернетом; дождаться готовности очереди. Войти, открыть главу и описание, каталог. Отключить сеть: уже загруженные JSON должны читаться из BrowserSession. Проверить объект без описания (BrowserDescription Collapsed). Завершить сессию: PNG и личные материалы очищаются прежней цепочкой; IdelData.getStatus() сохраняет успешные задачи. Войти повторно: успешные общие запросы не повторяются. Эти действия в реальном Unreal ещё предстоит подтвердить.
