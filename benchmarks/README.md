# Performance benchmarks

Измеряем реальный сетевой трафик, браузерные метрики, RSS и CPU time SSR-процесса через Playwright Chromium.

## Методология

- **Warmup**: 3 холодных запроса отбрасываются — нивелируют JIT/кеш Node.js
- **Runs**: 50 замеров на URL по умолчанию
- **Concurrency**: запросы идут параллельными батчами, по умолчанию `50`
- **Trimmed mean**: отбрасываем min и max, среднее по оставшимся значениям
- **Метрики собираются внутри браузера** через `performance.getEntriesByType('navigation')` и `'paint'`
- **Трафик** считается по реальным байтам ответов (document + script + stylesheet), включая транзитивные lazy-импорты которые браузер грузит при гидрации
- **RSS SSR-процесса** снимается через `ps` один раз до пачки измеряемых запросов и один раз сразу после неё; для `localhost` PID определяется по порту через `lsof`, либо задаётся вручную
- **CPU time SSR-процесса** снимается через `ps` один раз до пачки и один раз после неё; считается накопленное процессорное время процесса, а затем берётся дельта

## Установка

```bash
# Один раз — установить Chromium
npx playwright install chromium
```

## Запуск

```bash
# 1. Запустить оба сервера в отдельных терминалах:
cd examples/vue   && pnpm build && pnpm preview   # http://localhost:3000
cd examples/astro && pnpm build && node dist/server/entry.mjs  # http://localhost:4321

# 2. Запустить бенчмарк (из корня проекта):
node benchmarks/bench.mjs
```

Или с кастомными параметрами:

```bash
node benchmarks/bench.mjs --warmup 5 --runs 20
node benchmarks/bench.mjs --warmup 5 --runs 50 --concurrency 50

# Только конкретные URL:
node benchmarks/bench.mjs --urls "VUE /" http://localhost:3000/ "ASTRO /" http://localhost:4321/

# Если PID по порту не определяется автоматически:
node benchmarks/bench.mjs --pids 3000:12345 4321:23456
```

## Метрики

| Метрика | Что означает |
|---|---|
| **TTFB** | Время до первого байта ответа — чистый серверный рендер |
| **domInteractive** | Браузер распарсил HTML, начал выполнять скрипты |
| **domContentLoaded** | DOM построен, синхронные скрипты выполнены |
| **Load** | Все ресурсы загружены (img, css, js) |
| **FCP** | First Contentful Paint — первый видимый контент |
| **networkIdle** | Нет сетевой активности 500ms — острова загидрированы |
| **RSS before batch / after batch / delta batch** | Resident Set Size SSR-процесса до пачки запросов, после неё и разница |
| **CPU before batch / after batch / delta batch** | Накопленное CPU time SSR-процесса до пачки запросов, после неё и разница |
| **CPU / request** | Среднее CPU time на один запрос внутри пачки |

`RSS delta batch` показывает, насколько вырос или уменьшился RSS процесса за всю серию SSR-запросов. Это полезный сигнал по накоплению памяти, но не peak memory per render: на него влияют GC, аллокатор Node.js и фоновые кеши процесса.

`CPU delta batch` показывает суммарное процессорное время SSR-процесса, потраченное за серию запросов. Это лучше, чем `%CPU`, если нужна стоимость операций, но значение всё ещё включает любую фоновую работу того же процесса в пределах окна замера.

## Результаты (islands, 300 ProductCard)

### С гидрацией (`v-island="interaction"` / `client:idle`)

| | Vike+Vue | Astro |
|---|---|---|
| HTML | 577 KB | 651 KB |
| JS | 67 KB | 73 KB |
| TOTAL | 644 KB | 725 KB |
| TTFB | **13 ms** | 25 ms |
| domInteractive | **37 ms** | 72 ms |
| FCP | **78 ms** | 89 ms |
| networkIdle | **582 ms** | 602 ms |

Vike выигрывает — Astro сериализует пропсы всех 300 островов как JSON прямо в HTML (`astro-island` атрибуты), что раздувает документ.

### Чистый SSR без гидрации

| | Vike+Vue | Astro |
|---|---|---|
| HTML | 387 KB | **327 KB** |
| JS | 3.1 KB | **0 KB** |
| TOTAL | 390 KB | **327 KB** |
| TTFB | **8 ms** | **8 ms** |
| domInteractive | **28 ms** | 34 ms |
| Load | 64 ms | **36 ms** |
| FCP | 68 ms | **59 ms** |

Astro выигрывает — генерирует чистый HTML без `data-v-*` атрибутов Vue и без bootstrap JS.

## Выводы

- **Серверный рендер** (TTFB) одинаковый у обоих — ~2ms на простых страницах, ~8ms на 300 компонентах
- **Islands с гидрацией**: Vike компактнее (HTML меньше из-за отсутствия JSON-сериализации пропсов), быстрее TTFB и FCP
- **Pure SSR**: Astro выигрывает — нет JS вообще, HTML без лишних атрибутов
- **networkIdle** (~520-600ms) одинаковый — Vue runtime одинаков у обоих
