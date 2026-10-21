## WS11: <ім'я>

### Що зроблено

- [ ] **Task A** — `ai-runs/adr-without.md` + `ai-runs/adr-with.md`; `docs/constraints.md`; `docs/adr/0001-notifications.md`
- [ ] **Task B** — `ai-runs/c4-from-docs.md` + `ai-runs/c4-from-code.md`; `docs/architecture.md`
- [ ] **Task C** — `ai-runs/rca-v1.md` + `ai-runs/rca-v2.md`; `docs/rca.md`; `docs/postmortem.md`; `docs/runbook.md`
- [ ] **Task D** — `deploy/Dockerfile`, `deploy/compose.yaml`, `pipeline/deploy.yml`; `ai-runs/check-deploy-v1.txt`; нове правило в `tools/check-deploy.mjs` + тест у `tools/test/`; розділ «Action item → правило перевірки» у `docs/postmortem.md`
- [ ] **Task E (bonus)** — `docs/task-e-bonus.md`

### Числа

- **Task A:** без матеріалів <X> з <N>, з матеріалами <Y> з <N>
- **Task B:** з документації — вигадано <…>, пропущено <…>; з коду — вигадано <…>, пропущено <…>
- **Task C:** прогін 1 назвав причиною <…>, прогін 2 — <…>; збігаються з вашим RCA: <…>
- **Task D:** перша чернетка AI провалила <…> правил; нове правило: `<ID>` — <що перевіряє>

### Перевірка

- [ ] `cd app && npm test` — зелений
- [ ] `npm run test:tools` — зелений
- [ ] `npm run check:deploy` — усе PASS, з новим правилом
- [ ] Кожен прогін — у новій сесії; у `ai-runs/` — перші відповіді дослівно
- [ ] `incident/`, `materials/`, `docs/ops/` не змінено (`git diff --stat main -- incident materials docs/ops` — порожньо); `app/` не змінено (або причина — нижче)
- [ ] Нічого в `.github/workflows/`; жодних секретів і `.env`

### Інструмент і модель

### Зміни в `app/` і чому (якщо є)

### Що здивувало найбільше
