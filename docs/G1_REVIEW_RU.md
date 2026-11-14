> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# BudgetBranch — пакет проверки G1

**M1 завершён. Рекомендация независимого QA получена; G1 ожидает решения владельца.** Утверждённая G0 архитектура сохранена. Ни этот пакет, ни успешные тесты не заменяют отдельные G1/G2/G3.

## Версии и происхождение

- Итоговый code snapshot в integration: `51b161465a509c117f39487972c24128393651a8`. Следующий metadata commit содержит этот пакет и доказательства.
- Утверждённый владельцем G0 source commit: `a7057f2a0e68b71eacb2e0e277d1b0d3fcbd7ab2`.
- Freeze commit: `fa17fddbf8552d499851076ed926214cf810bd28`, tag `g0-approved-v0.1.0`. Точные версии и SHA-256 SPEC, ABI и заданий — [FROZEN_INTERFACE.json](FROZEN_INTERFACE.json). Все четыре хеша совпадают.
- Проверенный Contract source: `e8b437490a4d60c93870c644b2f4cf373dbba601`; принят как `9b2a9e7c114130cb68ec7f0d5f8e36ddae24607b`. Contracts tree: `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106`.
- Переносимая сборка и реальная SDK fixture: source `b191642fce6dd00426fa259fa306647ea8538c1f`, принят как `1e9d1f3d5343d258b44daeb89b6b394c319b0496`.
- Живой UI bridge: source `e69b0257d520bfedaf02bdc30ceaee62af0337ad`, принят как `5f5a29ab7a71950b06c9bc5fe52ac16629b31925`. Финальные принятые source/commit для UI и инструкции перечислены в [integration manifest](evidence/m1/integration-manifest.json).
- Переносимый BudgetBranch Wasm SHA-256: `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23`. Receiver: `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655`. [Manifest исходников, настроек и Wasm](../tests/portable-wasm.json).

Фактические model/effort интегратора: **UNKNOWN / UNKNOWN**. Инструмент принял Astra Max для Contract и независимого QA, Sol 6.1 Max для SDK/Agents, Frontend и Integration Tests. Это настройки запуска; serving telemetry не подтверждена. [Запуски и освобождение слотов](evidence/m1/worker-launches.json). Работа делегировалась асинхронно в отдельных worktrees; результаты принимались после проверки diff и независимых прогонов.

## Реальные результаты контракта

Интегратор заново собрал контракт и выполнил **15 Rust unit contexts и десять реальных Sandbox-наборов**. После введения переносимой сборки повторил все десять на новых Wasm; каждый завершился exit 0. [Команды/выходы portable-run](evidence/m1/integrator-portable-build/sandbox-run.json), [сводка](evidence/m1/integrator-portable-build/summary.json), [общий unit-прогон принятого checkout](evidence/m1/integrator-combined-unit/run.json).

| Требование G1 | Фактически наблюдалось |
| --- | --- |
| Wasm → Sandbox → receiver → callback | `cycle`: приём и отказ реального receiver, успешное исполнение двух приватных callback; проверены байты кода и отсутствие access keys у контрактов. |
| Полный SPEC | `full`: депозит10, A6 / B4, ребёнокA4, отказ второго выделения4; допустимый платёж, запретный получатель, receiver failure, revokeA, платёжB, reclaim3/5, native refund5. Итог **free3 / pending0 / spent2 / returned5  NEAR**. |
| Прямые отрицательные вызовы | `full`:11 отклонённых initiating receipts; `negatives`:15, включая depth4, нехватку газа, конфликты request ID, некорректные суммы/ID и чужой revoke. Вызовы идут прямо в контракт. |
| Авторизация и callback spoof | `adversarial`: forwarded owner signer и поддельный callback с настоящим promise dependency отклонены. |
| Failed / TooLong | Реальный Failed восстанавливает free через успешный callback. Успешный malformed64KiB return остаётся spent. Изолированный adversary не входит в нормальную deployment policy. |
| Pending/revoke | `interleaving`: spend, revoke и reclaim только свободной части до callback; отдельно успешный и отказавший receiver. Восстановленный после отказа free можно reclaim. |
| Native refund failure | `refund-failure`: disposable owner удалён до transfer; реальный отказ завершён успешным callback с ERR_TRANSFER_FAILED и восстановлением free. |
| Storage | Payment 304 B, recovery request 242 B; начальный recovery reserve **13.02528  NEAR**, отдельно фактический storage и0.1 NEAR buffer. `storage-boundary`: обычный рост отклонён, предоплаченный recovery доступен. |
| Callback gas | Максимум **2.302466890107 Tgas** из30 prepaid на portable Wasm. `maximum-state`:128 grants, depth3,8 receivers у каждого предка,64-byte account/request IDs; callback не увеличивает storage. |
| Исчерпание обычных квот | `capacity`:128 grants,512 spends,639достижимых normal requests. Завершение уже запланированных callback, revoke,127 reclaims и refund проходят без пополнения operational funding. |

Десятый набор `refund-order` подтверждает реальные receipts и конечный возврат. Он **не** доказывает контролируемое окно более позднего физического refund — см. пробелы ниже.

## Независимый Security QA

Отдельный Astra QA проверил точный commit `e8b4374`, затем независимо пересобрал и проверил portable candidate `b191642`. **Подтверждённых Critical/High findings нет.** Рекомендация относится к указанным source/tree/Wasm, не ко всем возможным сборкам или production.

Его отдельный реальный probe содержит **43 транзакции,22 ожидаемых отказа и пять settlement callbacks**. Он проверяет16 typed conflicts, раздельные caller namespaces, атомарный откат receipt после постановки выплаты в очередь, повторное использование откатившегося ID, точные ретраи после revoke и запрет нового spend. Результат повторён на переносимом Wasm. [Обзор и остаточные риски](SECURITY_REVIEW.md), [точный portable QA report](evidence/m1/security-qa-portable/qa-report.json), [сырые receipts](evidence/m1/security-qa-portable/sandbox-independent.json).

QA не утверждает, что самостоятельно повторил все десять developer suites. Это сделал интегратор. Независимый аудит всей собранной UI/bridge версии относится к G2 и ещё не выполнен.

## SDK и UI: дополнительные результаты интеграции

- В изолированном checkout интегратор выполнил `bootstrap` и `sdk-sandbox --offline`: **19 проверенных шагов,18 прямых SDK-транзакций, шесть ожидаемых отказов**, реальный pending/callback и итог3/0/2/5. [Команды](evidence/m1/integrator-sdk-sandbox/run.json), [raw JSONL](evidence/m1/integrator-sdk-sandbox/sdk-sandbox.jsonl).
- Через браузер интегратор выполнил **13 реальных UI-транзакций**: полный сценарий, два initiating отказа, Pending→Succeeded/Failed, наследование revoke и native owner refund5. [Tx hashes и наблюдения](evidence/m1/integrator-live-ui/scenario.json).
- Чужой Origin, отсутствующий session token и privileged RPC отклонены HTTP 403. [Проверки bridge](evidence/m1/integrator-live-ui/bridge-guards.json).
- **18 SDK + 5 agents + 4 web unit/MOCK checks** классифицированы отдельно. MOCK, SANDBOX и TESTNET визуально различаются. Live LLM не подключён, агенты scripted.

Эти проверки готовят G2, но не заменяют личную проверку владельца и отдельное разрешение `integration → main`.

## Что не подтверждено Sandbox

1. Контролируемый новый dispatch между успешным callback неуспешного receiver и более поздним физическим возвратом депозита. Оба receipts попали в один блок; порядок внутри блока не выдумывается. Low-cash ERR_LIQUIDITY проверен unit context; физическая защита присутствует в коде и обычные реальные refund receipts подтверждены.
2. Exact timestamp expiry, повтор аутентифицированного callback и отказ исполнения самого callback/OOG — unit contexts. Реальные unauthorized callbacks и pending/revoke покрыты Sandbox.
3. Комбинация всех достижимых максимальных состояний не исполнена независимым QA. Достижимый request bound≤4735=639normal+4096recovery; сумма настроенных caps5120 недостижима.

Потерянный/упавший callback может оставить pending навсегда. Нет тайм-аута, ручного подтверждения исхода или административного освобождения этих средств. Поддерживаются только проверенные синхронные неизменяемые receivers. Обычные квоты общие; recovery-квоты конечны и предоплачены. Operational endowment не выводится. Production-ready безопасность, произвольные receivers и Testnet-исполнение не заявляются.

## Как повторить

На Apple Silicon с Apple Command Line Tools, из чистого checkout:

```sh
./scripts/mac.sh bootstrap
./scripts/mac.sh sdk-sandbox
./scripts/mac.sh unit
./scripts/mac.sh web
```

[Native runbook](../scripts/README.md) и [contract suite runbook](../contracts/README.md). Первый запуск загружает закреплённые зависимости; повторный допускает `--offline`. Rust 1.95.0/Wasm, Node 24.14.0 / npm 11.9.0 и Sandbox 2.14.0 / protocol 88 изолированы внутри проекта.

Переносимость Wasm отдельно проверена: первоначально panic strings включали абсолютные registry paths. Target-specific path remapping сохранил `--cfg near`, исходники и ABI; независимые сборки совпали, все десять реальных suites и дополнительный QA-probe повторены. Старые хеши сохранены как история конкретной среды, не подменены новыми.

OrbStack установлен, но не был запущен: выбран context `orbstack`, daemon socket отсутствовал, `docker info` exit 1. Native ARM64 Sandbox работает. Глобальная конфигурация не менялась; контейнерные тесты и работающий Dockerfile не заявляются. [Фактическое сравнение](RUNTIME_CHOICE.md).

## Решение владельца

Рекомендуется **G1 APPROVED** в уже согласованных границах прототипа и с указанными пробелами покрытия. Альтернатива: `G1 CHANGES REQUIRED: …` с конкретным замечанием.

Все принимаемые изменения находятся только в `integration`. Main, push, публикация, Mainnet и реальные расходы не выполнялись. G2 и G3 остаются отдельными решениями. Повторный G0 не требуется: утверждённая архитектура не менялась.
