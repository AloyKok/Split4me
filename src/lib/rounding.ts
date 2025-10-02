const EPSILON = 1e-10;

const pow10 = (dp: number) => 10 ** dp;

export const roundHalfUp = (value: number, dp = 2) => {
  if (!Number.isFinite(value)) return value;
  const factor = pow10(dp);
  const scaled = value * factor;
  const sign = Math.sign(scaled) || 1;
  const absScaled = Math.abs(scaled) + EPSILON;
  const floor = Math.floor(absScaled);
  const fraction = absScaled - floor;
  const adjusted = fraction >= 0.5 ? floor + 1 : floor;
  return (adjusted * sign) / factor;
};

export const roundBankers = (value: number, dp = 2) => {
  if (!Number.isFinite(value)) return value;
  const factor = pow10(dp);
  const scaled = value * factor;
  const sign = Math.sign(scaled) || 1;
  const absScaled = Math.abs(scaled) + EPSILON;
  const floor = Math.floor(absScaled);
  const fraction = absScaled - floor;

  if (Math.abs(fraction - 0.5) < EPSILON) {
    const even = floor % 2 === 0;
    return ((even ? floor : floor + 1) * sign) / factor;
  }

  const adjusted = fraction > 0.5 ? floor + 1 : floor;
  return (adjusted * sign) / factor;
};

export const roundToNearestStep = (value: number, step = 0.1) => {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
};

export const distributeRemainder = (
  values: number[],
  targetSum: number,
  dp = 2,
) => {
  if (!values.length) return [] as number[];
  const factor = pow10(dp);
  const rounded = values.map((value) => Math.round(value * factor));
  const target = Math.round(targetSum * factor);
  let diff = target - rounded.reduce((sum, value) => sum + value, 0);

  if (diff === 0) return rounded.map((value) => value / factor);

  const ordering = rounded
    .map((value, index) => ({
      index,
      fraction: values[index] * factor - value,
    }))
    .sort((a, b) => (diff > 0 ? b.fraction - a.fraction : a.fraction - b.fraction));

  let cursor = 0;
  while (diff !== 0) {
    const entry = ordering[cursor % ordering.length];
    rounded[entry.index] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    cursor += 1;
  }

  return rounded.map((value) => value / factor);
};
