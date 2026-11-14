> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# BudgetBranch — решение G0

**G0 APPROVED FOR IMPLEMENTATION — решение владельца получено 2026-11-13.** Ниже сохранено резюме рассмотренной архитектуры; актуальная фиксация — [G0_APPROVAL](G0_APPROVAL.md), состояние реализации — [STATUS](STATUS.md).

## Что предлагается утвердить

1. **Контракты и средства.** Один BudgetBranch хранит тестовые NEAR; два экземпляра проверенного demo-receiver принимают/отклоняют выплаты. Делегирование и reclaim меняют только внутренний учёт. Депозит 10 NEAR отделён от денег на хранение и работу контракта. Глобально: `funded = сумма local free + pending + spent + owner returned`. Дочерние выделения не прибавляются к этой сумме второй раз.
2. **Права.** Агент — отдельный NEAR-аккаунт. Для новых операций проверяются фактические predecessor и signer, совпадение с владельцем grant и вся цепочка предков. Разрешены только прямые вызовы; срок, получатели и глубина могут сужаться. Корень на глубине 0, предел 3. Существующий grant неизменяем: revoke, возврат свободного остатка и новая выдача вместо расширения прав.
3. **ABI.** [SPEC](../SPEC.md) и [точные TS wire types / errors / events](abi.ts) задают deposit, delegate, spend, revoke, reclaim, refund_owner и views. Идентификаторы/суммы/время передаются строками; SDK и UI используют эти же типы. Сейчас это согласуемый черновик; после G0 — freeze. Root/common files принадлежат только интегратору, package-local manifests исключают конфликт общего lockfile.
4. **Async и отзыв.** До внешнего вызова сумма переходит в pending. Только приватный callback переводит её в succeeded/failed. Revoke блокирует новые операции ветки и не отменяет отправленный платёж. Неудача callback оставляет pending без тайм-аута и ручного «успеха». Логический возврат при отказе receiver может предшествовать фактическому возвратному receipt; отдельная проверка ликвидности не разрешит преждевременную выплату.
5. **Recovery.** Владелец возвращает только free от отозванных/просроченных узлов к родителю, затем выводит root.free отдельным native transfer с callback. Pending/spent не возвращаются. Для recovery выделены отдельные квоты и заранее оплаченный резерв: агент не может исчерпать обычные записи и заблокировать восстановление средств соседа. Но исчерпание общей обычной квоты может остановить **новые** платежи соседей; распределение квот по агентам отложено. Неустранимый pending и добровольное исчерпание владельцем собственной recovery-квоты также остаются ограничениями демонстрации.
6. **Граница доверия.** Получатели — только проверенные синхронные demo-receiver с зафиксированным кодом, без ключей/upgrade. Это проверяется при развёртывании, не заявляется on-chain проверкой code hash. Произвольные merchant-контракты не поддерживаются: их downstream Promise может вернуть ошибку после фактического получения денег. Ошибка разбора успешного ответа также не разрешает повторно зачислить сумму.

## Команда и готовность

| Роль | Модель / Max | Состояние |
| --- | --- | --- |
| Integrator | Требуется Astra 6 Max | Эффективная модель/effort текущей сессии не доступны для проверки; соответствие не заявляется |
| Security QA | `gpt-6-astra` / `max` | Явно выбраны в принятом native spawn, отдельный контекст; предварительный review выполнен, повторная проверка правок отражена в [отчёте](SECURITY_REVIEW.md) |
| Contract | `gpt-6-astra` / `max` | Инструмент поддерживает; старт после G0, `contracts/**` |
| SDK/Agents | `gpt-6.1-sol` / `max` | Старт после G0, `sdk/**`, `agents/**` |
| Frontend | `gpt-6.1-sol` / `max` | Старт после G0, `web/**` |
| Tests/CI | `gpt-6.1-sol` / `max` | Следующий свободный слот, `tests/**`, `scripts/**`, `.github/workflows/**` |

Доступны четыре слота вместе с интегратором. [План worktrees и задания](WORK_ALLOCATION.md) разделяет пути и запрещает исполнителям merge/push. Независимая телеметрия модели не предоставляется даже при успешном явном выборе параметров запуска; полное соответствие всех шести ролей пока не подтверждено.

Mac: ARM64, macOS 26.3.1(a). Rust/Cargo 1.94.0; выбранный near-sdk 5.30.1 требует Rust ≥1.95. Нет rustup, установленного Wasm target, cargo-near или Sandbox в PATH. Node 25.8.1/npm 11.11.0/pnpm 10.32.1 доступны. Нативный ARM64 Sandbox поддерживается upstream, локальный запуск ещё не доказан. Полные проверки — [STATUS](STATUS.md).

## Критерий следующего этапа

Реальный Sandbox: `10 → A:6/B:4 → A.child:4 → second child:4 FAIL → allowed spend PASS → forbidden spend FAIL → receiver rejection → revoke A → A/child FAIL, B PASS → reclaim + owner refund`. Обязательны негативные прямые вызовы, независимый QA, расход reserve/gas и восстановление после исчерпания агентских квот. Математическая проверка SPEC не заменяет эти тесты.

**Решение владельца: `G0 APPROVED FOR IMPLEMENTATION`.** Архитектура и перечисленные ограничения приняты; фактические model/effort интегратора сохраняются как UNKNOWN. Повторный G0 нужен только при существенном изменении архитектуры.

Эта остановка предусмотрена [PROMPT_INTEGRATOR_RU.md, §3](../PROMPT_INTEGRATOR_RU.md) — «Архитектуру заморозить только после G0 от владельца», и [AGENTS.md](../AGENTS.md) — «before parallel implementation». Согласие выполнить M0 позволило подготовить конкретные документы; оно не заменяет предусмотренное отдельное утверждение архитектуры. OpenAI Docs не требует этого согласования: оно задано вашим комплектом.
