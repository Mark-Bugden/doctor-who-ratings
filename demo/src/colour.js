// Colour maths for the heatmap's scale: parsing, OKLab interpolation, WCAG contrast and a
// colour-vision deficiency simulation for the tests. No DOM access.

/** Parses a CSS hex colour, #rgb or #rrggbb, into [r, g, b] (0–255). */
export function parseHex(color) {
  const hex = color.trim().replace(/^#/, '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`colour: expected a hex colour, got "${color}"`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** Formats [r, g, b] (0–255, clamped and rounded) as #rrggbb. */
export function toHex(rgb) {
  return `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

const toLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);

/** [r, g, b] (0–255) to OKLab [L, a, b]. */
export function toOklab(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab [L, a, b] to [r, g, b] (0–255, unclamped). */
export function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear);
}

/** A function from t in [0, 1] to a hex colour, interpolating `low` to `high` in OKLab. */
export function interpolate(low, high) {
  const a = toOklab(parseHex(low));
  const b = toOklab(parseHex(high));
  return (t) => {
    const u = Math.min(1, Math.max(0, t));
    return toHex(fromOklab(a.map((x, i) => x + (b[i] - x) * u)));
  };
}

/** WCAG 2 relative luminance of a hex colour. */
export function luminance(color) {
  const [r, g, b] = parseHex(color).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two hex colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Machado, Oliveira and Fernandes (2009), severity 1.0, applied to linear RGB.
const CVD = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export const DEFICIENCIES = Object.keys(CVD);

/** How a hex colour looks with the given colour-vision deficiency, as a hex colour. */
export function simulate(color, deficiency) {
  const linear = parseHex(color).map(toLinear);
  const mixed = CVD[deficiency].map((row) => row.reduce((sum, k, i) => sum + k * linear[i], 0));
  return toHex(mixed.map((l) => fromLinear(Math.min(1, Math.max(0, l)))));
}

/** The OKLab distance between two hex colours. */
export function distance(a, b) {
  const [x, y] = [toOklab(parseHex(a)), toOklab(parseHex(b))];
  return Math.hypot(...x.map((v, i) => v - y[i]));
}
