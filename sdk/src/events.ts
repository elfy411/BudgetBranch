import { eventPayloads, invalid, isRecord } from './decode.js';
import type { BudgetEvent, EventPayloads } from './types.js';

const PREFIX = 'EVENT_JSON:';

export function parseBudgetEvent(log: string): BudgetEvent | null {
  if (!log.startsWith(PREFIX)) return null;

  let value: unknown;
  try {
    value = JSON.parse(log.slice(PREFIX.length)) as unknown;
  } catch {
    return invalid('Event log', 'valid JSON');
  }
  if (!isRecord(value) || value.standard !== 'budgetbranch') return null;
  if (value.version !== '0.1.0' || typeof value.event !== 'string'
    || !Object.hasOwn(eventPayloads, value.event) || !Array.isArray(value.data) || value.data.length !== 1) {
    return invalid('BudgetBranch event', 'a supported 0.1.0 event with a single payload');
  }

  const event = value.event as keyof EventPayloads;
  const payload = eventPayloads[event](value.data[0], `${event}.data[0]`);
  if (event === 'payment_pending' || event === 'payment_succeeded' || event === 'payment_failed') {
    if (!('status' in payload) || `payment_${payload.status}` !== event) {
      return invalid(event, 'a payment event matching its payload status');
    }
  }
  return { standard: 'budgetbranch', version: '0.1.0', event, data: [payload] } as BudgetEvent;
}
