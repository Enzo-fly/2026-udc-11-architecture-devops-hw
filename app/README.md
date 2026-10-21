# Поштомат громади

Сервіс для поштоматів громади: служба доставки реєструє посилку, мешканець отримує SMS
з кодом і забирає посилку, ввівши код на екрані поштомата.

## Що всередині

- `src/server.js` — HTTP API: `POST /parcels`, `POST /pickup`, `GET /admin/parcels`,
  `GET /health`.
- `src/worker.js` — шле SMS про прибуття посилок.
- `bin/expire-parcels.js` — нічна задача для посилок, що пролежали понад 72 години.
- `src/config.js` — усі налаштування беруться зі змінних оточення.

Архітектура — у [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Локально

```bash
npm test      # Node 22+, без npm install — залежностей немає
npm start     # API на http://localhost:8080
```

Сховище в цьому репозиторії — у пам'яті (`src/db.js`); у продакшні той самий інтерфейс
працює поверх PostgreSQL.
