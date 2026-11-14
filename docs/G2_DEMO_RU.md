> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Демонстрация BudgetBranch для G2

Это локальное приложение на настоящем NEAR Sandbox. Все NEAR тестовые. SDK и агенты исполняют воспроизводимый сценарий; языковая модель в приложение не подключена.

## Запуск на Apple Silicon

Нужны нативный ARM64 Mac, Apple Command Line Tools и HTTPS для первой загрузки зависимостей. Из корня checkout:

```sh
./scripts/mac.sh bootstrap
./scripts/mac.sh sdk-sandbox
./scripts/mac.sh unit
./scripts/mac.sh web
```

`sdk-sandbox` должен закончиться `PASS`: 19 шагов, 18 транзакций, шесть ожидаемых отказов, итог `3 / 0 / 2 / 5`. `unit` отдельно проверяет синтетические Rust-контексты и SDK/agents unit/MOCK. Веб-проверки:

```sh
./scripts/mac.sh env npm --prefix web ci --ignore-scripts --no-audit --no-fund
./scripts/mac.sh env npm --prefix web test
./scripts/mac.sh env npm --prefix web run build
```

Откройте URL `REAL NEAR SANDBOX` из терминала `web`. Каждый запуск создаёт новую цепь с нулевым бизнес-бюджетом. Необходимый storage/operational reserve fixture финансирует отдельно. После первой успешной установки можно добавлять `--offline`. Ctrl-C останавливает цепь и удаляет её временный каталог. При занятом порте: `BB_WEB_PORT=5387 ./scripts/mac.sh web --offline`. Подробности и диагностика — [runbook](../scripts/README.md).

## Сценарий на экране

Перед каждым действием выберите **Local Sandbox signer** и нужный узел дерева. После квитанции дождитесь обновления finalized snapshot или нажмите **Refresh snapshot**. Принятие запроса и завершение выплаты отображаются отдельно. Не повторяйте депозит только потому, что старый снимок ещё не обновился.

| Шаг | Действия | Что показать |
| --- | --- | --- |
| 1. Обеспеченный бюджет | Owner, root → **Fund budget 10**. Затем **Delegate 6** для `agent-a.test.near`. | Средства остаются в одном контракте. Root free становится 4, A free — 6; глобальный free остаётся 10. Root остаётся выбранным после создания A. |
| 2. Сужение прав | Owner, root → **Delegate 4** для `agent-b.test.near`. Снимите `reject.test.near`, оставьте `accept.test.near`; выберите **Depth ceiling 1** и ближайший будущий срок UTC. | B получает 4, только одного получателя и глубину 1/1. У B **Delegate** недоступна. Срок должен быть позже текущего времени Sandbox; фиксированную дату из исторического лога копировать не нужно. |
| 3. Вложенная ветка и перерасход | Agent A, узел A → **Delegate 4** для `child.test.near`. Попробуйте ещё **4** для `stranger.test.near`. | Child получает 4; у A остаётся 2. Второй запрос получает настоящий `ERR_INSUFFICIENT_FREE`, бюджет не увеличивается. |
| 4. Выплаты | Child, узел child → **Spend 1** для `accept.test.near`; затем **1** для `stranger.test.near`; затем **1** для `reject.test.near`. | Первый платёж — Succeeded. Чужой получатель — `ERR_RECIPIENT`. Rejecting receiver: запрос принят, платёж проходит Pending → Failed / `ERR_RECEIVER_FAILED`; child free возвращается к 3 после callback. Быстрый callback может завершиться между обновлениями экрана. |
| 5. Отзыв и соседняя ветка | Owner, узел A → **Revoke branch**. Выберите Child: новые действия заблокированы унаследованным отзывом. Затем Agent B, узел B → **Spend 1** для `reject.test.near`, после отказа — **1** для `accept.test.near`. | Суженный allowlist B проверяется контрактом: первый вызов отклонён `ERR_RECIPIENT`; разрешённый платёж B завершается. Отзыв A не отзывает B. Это не гарантия независимой доступности B при исчерпании общих квот. |
| 6. Возврат владельцу | Owner: child → **Reclaim to parent 3**; A → **Reclaim to parent 5**; root → **Refund owner 5**. | Reclaim перемещает логический резерв вверх. Refund — отдельный native transfer с callback. Итог: **Logical free 3 / Pending 0 / Spent 2 / Refunded 5**. |

В **Recent payments** должны остаться три успешных записи, включая owner refund, и один Failed. В истории этой сессии — 11 принятых транзакций; ещё три отклонённых вызова видны в соответствующих формах и сохранённых доказательствах. Это 14 реальных транзакций всего.

Короткая проверка владельца для G2: запустить приложение, пополнить 10, создать A6 и попробовать второе выделение 6 из root. Для полного показа перезапустите `web` и выполните таблицу целиком.

## Как читать деньги и ограничения

Глобальный free суммирует локальный free узлов. `Child commitments` — обязательства родителя перед прямыми детьми, включая уже потраченные ими суммы; добавлять их ещё раз к глобальному бюджету нельзя. После полного сценария root free равен 0, а оставшиеся 3 находятся у B.

Physical liquidity показывает доступный физический баланс сверх защищённых operating funds. Это отдельная величина: логическое восстановление free после неудачи само по себе не доказывает, что физический refund уже поступил. В контракте сохранён `ERR_LIQUIDITY` перед исходящими выплатами.

Локальный signer — доверенный инструмент одного оператора с переключением всех disposable ролей. Он не предоставляет многопользовательскую авторизацию или хранение пользовательских кошельков. Поддерживаются только заранее проверенные синхронные неизменяемые receivers. Потеря callback может навсегда оставить платёж Pending; timeout/admin-разблокировки нет. Operational funding не выводится; обычные и recovery-квоты конечны. [Полный пакет G2 и риски](G2_REVIEW_RU.md).
