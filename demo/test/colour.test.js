import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DEFICIENCIES, contrast, distance, interpolate, parseHex, simulate, toHex, toOklab } from '../src/colour.js';

// The kit's tokens (demo-kit v0.2.0) that the heatmap scale sits on and ends at.
const KIT = {
  dark: { surface: '#111722', high: '#f6be55' }, // --color-surface, --color-sodium
  light: { surface: '#ffffff', high: '#c2391b' }, // --color-surface, --color-halpha
};

// The scale's low ends, as demo.css sets them: on [data-demo], then under data-theme="light".
const css = readFileSync(new URL('../src/demo.css', import.meta.url), 'utf8');
const [dark, light] = [...css.matchAll(/--dw-heat-low:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]);
const SCALES = {
  dark: { ...KIT.dark, low: dark },
  light: { ...KIT.light, low: light },
};

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

test('computes WCAG contrast', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrast('#c2391b', '#ffffff').toFixed(2), '5.39');
});

for (const [theme, { surface, low, high }] of Object.entries(SCALES)) {
  test(`${theme}: every step of the heatmap scale clears 3:1 on the surface`, () => {
    const scale = interpolate(low, high);
    for (let i = 0; i <= 10; i++) assert.ok(contrast(scale(i / 10), surface) >= 3, `${scale(i / 10)} at ${i / 10}`);
  });

  test(`${theme}: the scale's lightness runs one way, with and without colour-vision deficiencies`, () => {
    const scale = interpolate(low, high);
    const steps = Array.from({ length: 11 }, (_, i) => scale(i / 10));
    for (const vision of ['normal', ...DEFICIENCIES]) {
      const seen = vision === 'normal' ? steps : steps.map((color) => simulate(color, vision));
      const l = seen.map(lightness);
      const direction = Math.sign(l.at(-1) - l[0]);
      assert.ok(l.slice(1).every((value, i) => Math.sign(value - l[i]) === direction), `${vision}: ${l.map((v) => v.toFixed(3))}`);
    }
  });

  test(`${theme}: six steps of the scale stay apart with colour-vision deficiencies`, () => {
    const scale = interpolate(low, high);
    const steps = Array.from({ length: 6 }, (_, i) => scale(i / 5));
    // OKLab distance; about 0.02 is a just-noticeable difference. Measured minimums: dark 0.053
    // (tritanopia), light 0.037 (deuteranopia). The light scale is the tighter one, because its low
    // end can be no lighter than 3:1 on white allows.
    const minimum = theme === 'light' ? 0.035 : 0.05;
    for (const vision of ['normal', ...DEFICIENCIES]) {
      const seen = vision === 'normal' ? steps : steps.map((color) => simulate(color, vision));
      for (let i = 1; i < seen.length; i++) assert.ok(distance(seen[i - 1], seen[i]) >= minimum, `${vision}, step ${i}`);
    }
  });
}
