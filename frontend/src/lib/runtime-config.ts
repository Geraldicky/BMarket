function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const PAYMENT_POLL_INTERVAL_MS = positiveInteger(
  process.env.EXPO_PUBLIC_PAYMENT_POLL_INTERVAL_MS,
  5_000,
);
