# Отдельные панели в Unreal

Сборка поддерживает четыре режима. Без параметра panel работает прежний полный интерфейс.
Все пути ниже добавляются к вашему абсолютному file URL index.html.

| Web Browser | Параметры URL | Размер UMG (при DPI Scale 1) | Положение |
| --- | --- | --- | --- |
| BrowserSession | ?mode=unreal&panel=session | Весь экран | Stretch, offsets 0 |
| BrowserEnvironment | ?mode=unreal&panel=environment | 340 x 340 | Верхний левый угол, X=40 Y=40 |
| BrowserToolbar | ?mode=unreal&panel=toolbar | 340 x 120 | Нижний левый угол, alignment 0,1, X=40 Y=-40 |
| BrowserCompass | ?mode=unreal&panel=compass | 56 x 64 | Верхний правый угол, alignment 1,0, X=-36 Y=32 |

У компактных браузеров используйте точечные anchors, не Stretch. На всех
включите Supports Transparency, Is Variable, Visibility=Visible.
Размеры указаны для масштаба браузерного контента 1:1; проверьте проектную DPI
кривую в Play. В изолированных панелях нет мобильных отступов или 4K transform:
позиционирование и масштаб задаются UMG. Компас имеет запас под исходный SVG.

## Иерархия WBP_IdelPreview

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
