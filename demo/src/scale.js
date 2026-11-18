// Scales and ticks for the charts. No DOM access.

/** A linear map from [d0, d1] to [r0, r1]. */
export function linear([d0, d1], [r0, r1]) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (value) => r0 + (value - d0) * k;
}

/** A logarithmic map from [d0, d1] (both positive) to [r0, r1]. */
export function log([d0, d1], [r0, r1]) {
  const scale = linear([Math.log10(d0), Math.log10(d1)], [r0, r1]);
  return (value) => scale(Math.log10(value));
}

/** Round ticks from min to max: steps of 1, 2 or 5 times a power of ten, about `count` of them. */
export function ticks(min, max, count = 5) {
  const raw = (max - min) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const result = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    result.push(Number(value.toPrecision(12)));
  }
  return result;
}

/** Ticks for a log scale: 1, 2 and 5 times each power of ten within [min, max]. */
export function logTicks(min, max) {
  const result = [];
  for (let power = Math.floor(Math.log10(min)); power <= Math.ceil(Math.log10(max)); power++) {
    for (const m of [1, 2, 5]) {
      const value = m * 10 ** power;
      if (value >= min && value <= max) result.push(value);
    }
  }
  return result;
}

/** Years to label on a time axis: every 5, 10 or 20 years, whichever leaves about `spacing` px between them. */
export function yearTicks(firstYear, lastYear, width, spacing = 56) {
  const perYear = width / Math.max(1, lastYear - firstYear);
  const every = [5, 10, 20].find((n) => n * perYear >= spacing) ?? 20;
  const result = [];
  for (let year = Math.ceil(firstYear / every) * every; year <= lastYear; year += every) result.push(year);
  return result;
}
