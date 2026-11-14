import { yoctoToNear } from "@budgetbranch/sdk";
import type { Amount, U64 } from "@budgetbranch/sdk";

export function NearAmount({ amount, unit = true, maxFractionDigits }: {
  amount: Amount;
  unit?: boolean;
  maxFractionDigits?: number;
}) {
  const exactNear = yoctoToNear(amount);
  const [whole, fraction = ""] = exactNear.split(".");
  const shownFraction = fraction.slice(0, maxFractionDigits);
  const grouped = BigInt(whole).toLocaleString("en-US");
  const value = shownFraction ? `${grouped}.${shownFraction}` : grouped;
  const title = maxFractionDigits === undefined ? `${amount} yoctoNEAR` : `${exactNear} NEAR (${amount} yoctoNEAR)`;
  return <span className="near-amount" title={title}>
    <span className="near-value">{value}{shownFraction !== fraction && "…"}</span>
    {unit && <> <span className="near-unit">NEAR</span></>}
  </span>;
}

const utcFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

export function ChainTime({ timestamp }: { timestamp: U64 }) {
  const date = new Date(Number(BigInt(timestamp) / 1_000_000n));
  return <time dateTime={date.toISOString()} title={`${timestamp} ns`}>{utcFormatter.format(date)} UTC</time>;
}

export function Status({ value }: { value: string }) {
  return <span className={`status status--${value}`}>{value}</span>;
}
