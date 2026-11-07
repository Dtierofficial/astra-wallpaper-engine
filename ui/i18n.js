(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WEI18n=api;
})(typeof window==='undefined'?globalThis:window,function(){
  const en={
    installed:'Installed',favorites:'Favorites',settings:'Settings',refresh:'Refresh',localLibrary:'Local library · Steam',
    connecting:'Connecting…',connected:'Connected · v{version}',noConnection:'Not connected',search:'Search wallpapers…',
    allTypes:'All types',video:'Video',image:'Images / GIF',scene:'Scenes',web:'Web',byName:'By name',byDate:'Recently modified',
    tileSize:'Card size',typeLabel:'Wallpaper type',sortLabel:'Sort order',results:'Wallpapers: {shown} / {total}',compatibleOnly:'Playable only',
    empty:'No results. Change the search or filters.',placeholderTitle:'Your wallpapers. Inside Astra.',
    placeholderBody:'Select a wallpaper to inspect it and apply the background.',placeholderHint:'Video, images and basic Web wallpapers. Scene/PKG playback is not supported.',
    apply:'Apply in Astra',applied:'Selected in Astra',favoriteToggle:'Toggle favorite',downloaded:'Downloaded',active:'ACTIVE',
    playableVideo:'Video in Astra',playableImage:'Image in Astra',playableWeb:'Web (beta)',catalogOnly:'Catalog only',
    unsupported:'This format requires the Wallpaper Engine renderer. Scene/PKG cannot be played in Astra yet. Its preview is not a live scene.',
    webWarning:'Experimental: local HTML/CSS/JS only. Native WE plugins, external network requests, file pickers and scene APIs are unavailable. Only run Web wallpapers you trust.',
    playbackTitle:'Playback in Astra',volume:'Volume',speed:'Speed',fit:'Scaling',cover:'Fill / crop',contain:'Fit',fill:'Stretch',
    save:'Save settings',reset:'Read WE settings again',dim:'UI dimming',weSettings:'Settings from Wallpaper Engine',readOnly:'read-only',
    monitor:'WE settings monitor',noProperties:'No individual properties.',propertiesNote:'Values are copied from WE; not every WE feature has a browser equivalent. Astra settings are stored separately.',
    useProperties:'Apply property changes',propertiesSaved:'Web properties saved.',propertiesReset:'Local overrides cleared.',
    selected:'Wallpaper selected. Checking the background renderer…',playing:'The background renderer is running.',
    noRenderer:'The background layer is not responding. Restart the plugin.',saved:'Astra settings saved. Wallpaper Engine files were not changed.',
    cleared:'Background disabled',clear:'Remove Astra background',status:'{playable} playable · {total} downloaded wallpapers',errors:' · Read errors: {count}',
    connectionSettings:'Connection settings',steamLibraries:'Steam libraries',pathsHint:'Libraries are detected automatically. Wallpaper Engine files are not modified.',
    rescan:'Rescan library',performance:'Performance',performanceHint:'When Astra is minimized, hidden or closed, the renderer is released. On Windows a read-only window-state helper supplements WebView visibility events. No video continues in a separate background renderer.',
    performanceNote:'The helper checks window visibility; it does not read screen content. No AI calls, desktop capture or video encoding.',
    formats:'Format support',formatsHint:'Video: MP4 / WebM / OGV if the WebView supports the codec. Images: PNG / JPG / WebP / GIF. Web: experimental local HTML/CSS/JS with properties and optional audio bands. Scene / PKG: catalog only.',
    compatibilityHint:'WE settings are read for the chosen monitor. Changes made in Astra do not alter WE. Web audio and device APIs are not fully equivalent to Wallpaper Engine.',
    language:'Interface language',automatic:'Automatic (Astra)',languageHint:'One package supports Russian and English. Other Astra languages fall back to English.',
    nativeVisible:'Astra window is visible',nativeHidden:'Astra is hidden or minimized — wallpaper stopped',nativeUnknown:'Native visibility unavailable; using WebView visibility',
    waitRenderer:'Waiting for the selected wallpaper to start',idle:'Background connected. Select a wallpaper.',
    rendererVideo:'Video is playing',rendererMuted:'Video is playing without sound',rendererImage:'Image is displayed',rendererWeb:'Web wallpaper loaded',
    mediaError:'Cannot load media (code {code}). Check its codec and local file access.',bridgeError:'Astra bridge failed to load',
    previewHint:'Open this page inside Astra or start npm run preview.',
    badParams:'Expected a parameter object.',notFound:'Wallpaper not found.',unsupportedError:'This wallpaper format is not supported.',
    badPlayback:'Invalid playback settings.',badDim:'Dimming must be between 0 and 90.',badMonitor:'Invalid monitor.',unknownCommand:'Unknown command.',
    badLanguage:'Unsupported language.',badProperties:'Invalid wallpaper properties.',badRenderer:'Invalid renderer status.',networkError:'Cannot connect to the plugin.',
    ratingUnknown:'Unknown',schemeColor:'Scheme color',webConsent:'I trust this Web wallpaper and want to run its JavaScript inside an isolated frame.',
    webConsentRequired:'Confirm that you trust this Web wallpaper before applying it.'
  };
  const ru={
    installed:'Установлено',favorites:'Избранное',settings:'Настройки',refresh:'Обновить',localLibrary:'Локальная библиотека · Steam',
    connecting:'Подключение…',connected:'Подключено · v{version}',noConnection:'Нет подключения',search:'Поиск обоев…',
    allTypes:'Все типы',video:'Видео',image:'Картинки / GIF',scene:'Сцены',web:'Web',byName:'По названию',byDate:'Недавно изменённые',
    tileSize:'Размер карточек',typeLabel:'Тип обоев',sortLabel:'Сортировка',results:'Обои: {shown} / {total}',compatibleOnly:'Только воспроизводимые',
    empty:'Ничего не найдено. Измени поиск или фильтры.',placeholderTitle:'Твои обои. Внутри Astra.',
    placeholderBody:'Выбери обои, чтобы посмотреть свойства и установить фон.',placeholderHint:'Видео, картинки и базовые Web-обои. Scene/PKG пока не воспроизводятся.',
    apply:'Применить в Astra',applied:'Выбрано в Astra',favoriteToggle:'Переключить избранное',downloaded:'Скачано',active:'АКТИВНЫ',
    playableVideo:'Видео в Astra',playableImage:'Картинка в Astra',playableWeb:'Web (бета)',catalogOnly:'Только каталог',
    unsupported:'Для этого формата нужен движок Wallpaper Engine. Scene/PKG пока не воспроизводятся в Astra. Превью не подменяет живую сцену.',
    webWarning:'Экспериментально: локальные HTML/CSS/JS. Нативные плагины WE, внешние сетевые запросы, выбор файлов и API сцен недоступны. Запускай только Web-обои, которым доверяешь.',
    playbackTitle:'Воспроизведение в Astra',volume:'Громкость',speed:'Скорость',fit:'Масштаб',cover:'Заполнить / обрезать',contain:'Вписать',fill:'Растянуть',
    save:'Сохранить параметры',reset:'Заново взять настройки WE',dim:'Затемнение UI',weSettings:'Настройки из Wallpaper Engine',readOnly:'только чтение',
    monitor:'Монитор настроек WE',noProperties:'Индивидуальных свойств нет.',propertiesNote:'Значения берутся из WE; не каждой функции WE есть браузерный аналог. Настройки Astra хранятся отдельно.',
    useProperties:'Применить свойства',propertiesSaved:'Свойства Web-обоев сохранены.',propertiesReset:'Локальные переопределения сброшены.',
    selected:'Обои выбраны. Проверяем запуск фонового плеера…',playing:'Фоновый плеер запущен.',
    noRenderer:'Фоновый слой не отвечает. Перезапусти плагин.',saved:'Параметры Astra сохранены. Файлы Wallpaper Engine не изменены.',
    cleared:'Фон отключён',clear:'Убрать фон Astra',status:'{playable} воспроизводимых · {total} скачанных обоев',errors:' · Ошибок чтения: {count}',
    connectionSettings:'Настройки подключения',steamLibraries:'Библиотеки Steam',pathsHint:'Папки определяются автоматически. Файлы Wallpaper Engine не изменяются.',
    rescan:'Пересканировать библиотеку',performance:'Производительность',performanceHint:'Когда Astra свёрнута, скрыта или закрыта, плеер освобождается. В Windows помощник проверки состояния окна дополняет события видимости WebView. Отдельного фонового видеорендерера нет.',
    performanceNote:'Помощник проверяет только видимость окна, не читает содержимое экрана. Нет запросов к ИИ, захвата экрана или кодирования видео.',
    formats:'Поддержка форматов',formatsHint:'Видео: MP4 / WebM / OGV, если кодек поддерживается WebView. Картинки: PNG / JPG / WebP / GIF. Web: экспериментальные локальные HTML/CSS/JS со свойствами и опциональным аудиоспектром. Scene / PKG: только каталог.',
    compatibilityHint:'Настройки WE читаются для выбранного монитора. Изменения в Astra не меняют WE. Аудио и системные API Web-обоев не полностью эквивалентны Wallpaper Engine.',
    language:'Язык интерфейса',automatic:'Автоматически (Astra)',languageHint:'Один пакет поддерживает русский и английский. Для других языков Astra используется английский.',
    nativeVisible:'Окно Astra видно',nativeHidden:'Astra скрыта или свёрнута — обои остановлены',nativeUnknown:'Нативная проверка недоступна; используется видимость WebView',
    waitRenderer:'Ожидание запуска выбранных обоев',idle:'Фоновый слой подключён. Выбери обои.',
    rendererVideo:'Видео воспроизводится',rendererMuted:'Видео воспроизводится без звука',rendererImage:'Картинка отображается',rendererWeb:'Web-обои загружены',
    mediaError:'Медиа не загрузилось (код {code}). Проверь кодек и доступ к локальному файлу.',bridgeError:'Не загрузился мост Astra',
    previewHint:'Открой страницу в Astra или запусти npm run preview.',
    badParams:'Ожидался объект параметров.',notFound:'Обои не найдены.',unsupportedError:'Этот формат обоев не поддерживается.',
    badPlayback:'Недопустимые настройки воспроизведения.',badDim:'Затемнение должно быть от 0 до 90.',badMonitor:'Недопустимый монитор.',unknownCommand:'Неизвестная команда.',
    badLanguage:'Неподдерживаемый язык.',badProperties:'Недопустимые свойства обоев.',badRenderer:'Недопустимый статус плеера.',networkError:'Нет связи с плагином.',
    ratingUnknown:'Неизвестно',schemeColor:'Цвет схемы',webConsent:'Я доверяю этим Web-обоям и хочу запустить их JavaScript в изолированном фрейме.',
    webConsentRequired:'Подтверди доверие к Web-обоям перед применением.'
  };
  function normalize(value){return String(value||'').toLowerCase().split(/[-_]/)[0]==='ru'?'ru':'en';}
  function t(language,key,params={}){return (Object.hasOwn(({en,ru})[normalize(language)],key)?({en,ru})[normalize(language)][key]:key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??`{${name}}`));}
  return {en,ru,normalize,t};
});
