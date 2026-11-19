import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DEFICIENCIES, contrast, distance, interpolate, parseHex, ramp, simulate, toHex, toOklab } from '../src/colour.js';

// The kit's surface colours (demo-kit v0.2.0), which the heatmap is drawn on.
const SURFACE = { dark: '#111722', light: '#ffffff' };

// The scale's stops, as demo.css sets them: on [data-demo], then under data-theme="light".
const css = readFileSync(new URL('../src/demo.css', import.meta.url), 'utf8');
const [dark, light] = [...css.matchAll(/--dw-heat:\s*([^;]+);/g)].map((match) => match[1].trim().split(/\s+/));
const SCALES = {
  dark: { surface: SURFACE.dark, stops: dark },
  light: { surface: SURFACE.light, stops: light },
};
// Enough steps to land on every stop of a scale of four (0, 1/3, 2/3 and 1) and between them.
const STEPS = 31;
const steps = (scale, n) => Array.from({ length: n }, (_, i) => scale(i / (n - 1)));

const lightness = (color) => toOklab(parseHex(color))[0];

test('parses and formats hex colours', () => {
  assert.deepEqual(parseHex('#f6be55'), [246, 190, 85]);
  assert.deepEqual(parseHex(' #FFF '), [255, 255, 255]);
  assert.equal(toHex([246, 190, 85]), '#f6be55');
  assert.throws(() => parseHex('rgb(0, 0, 0)'), /hex/);
});

test('interpolates from one end to the other', () => {
  const scale = interpolate('#000000', '#ffffff');
  assert.equal(scale(0), '#000000');
  assert.equal(scale(1), '#ffffff');
  assert.equal(scale(-1), '#000000');
  assert.equal(scale(2), '#ffffff');
});

test('ramps through each stop in turn', () => {
  const scale = ramp(['#000000', '#ff0000', '#ffffff']);
  assert.equal(scale(0), '#000000');
  assert.equal(scale(0.5), '#ff0000');
  assert.equal(scale(1), '#ffffff');
  assert.equal(scale(0.25), interpolate('#000000', '#ff0000')(0.5));
  assert.equal(scale(-1), '#000000');
  assert.equal(scale(2), '#ffffff');
  assert.throws(() => ramp(['#000000']), /two or more/);
});

test('computes WCAG contrast', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrast('#c2391b', '#ffffff').toFixed(2), '5.39');
});

test('the stylesheet sets a scale of hex stops for each theme', () => {
  for (const stops of [dark, light]) {
    assert.ok(stops.length >= 2);
    for (const stop of stops) assert.match(stop, /^#[0-9a-f]{6}$/i);
  }
});

for (const [theme, { surface, stops }] of Object.entries(SCALES)) {
  test(`${theme}: every step of the heatmap scale clears 3:1 on the surface`, () => {
    for (const color of steps(ramp(stops), STEPS)) assert.ok(contrast(color, surface) >= 3, color);
  });

  test(`${theme}: the scale's lightness runs one way, with and without colour-vision deficiencies`, () => {
    const all = steps(ramp(stops), STEPS);
    for (const vision of ['normal', ...DEFICIENCIES]) {
      const seen = vision === 'normal' ? all : all.map((color) => simulate(color, vision));
      const l = seen.map(lightness);
      const direction = Math.sign(l.at(-1) - l[0]);
      assert.ok(l.slice(1).every((value, i) => Math.sign(value - l[i]) === direction), `${vision}: ${l.map((v) => v.toFixed(3))}`);
    }
  });

  test(`${theme}: six steps of the scale stay apart with colour-vision deficiencies`, () => {
    const six = steps(ramp(stops), 6);
    // OKLab distance; about 0.02 is a just-noticeable difference. Measured minimums: dark 0.075,
    // light 0.051, both under tritanopia.
    for (const vision of ['normal', ...DEFICIENCIES]) {
      const seen = vision === 'normal' ? six : six.map((color) => simulate(color, vision));
      for (let i = 1; i < seen.length; i++) assert.ok(distance(seen[i - 1], seen[i]) >= 0.05, `${vision}, step ${i}`);
    }
  });
}
