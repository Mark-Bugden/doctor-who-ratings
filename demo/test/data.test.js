import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { prepare, years } from '../src/data.js';
import { longDate } from '../src/format.js';
import { contrast, ramp } from '@mark-bugden/demo-kit';
import { ink, position } from '../src/views/heatmap.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const raw = read('../public/data/episodes.json');
const data = prepare(raw);
const manifest = read('../public/manifest.json');

test('links every part to its story and Doctor, and back', () => {
  assert.equal(data.parts.length, raw.parts.length);
  for (const part of data.parts) {
    assert.ok(part.story.parts.includes(part));
    assert.ok(part.story.doctor.parts.includes(part));
    assert.equal(part.story.parts[part.number - 1], part);
  }
  // The Doctors are the same objects the stories point to, so a selected Doctor matches its stories.
  for (const story of data.stories) assert.ok(data.doctors.includes(story.doctor));
});

test('a story rates the mean of its parts', () => {
  const story = data.stories.find((s) => s.title === 'The Daleks');
  const ratings = story.parts.map((p) => p.rating);
  assert.equal(story.rating, ratings.reduce((a, b) => a + b) / ratings.length);
  assert.equal(story.parts.length, 7);
});

test('splits the eras into seasons in order', () => {
  assert.equal(data.eras.classic.seasons.length, 26);
  assert.equal(data.eras.revived.seasons.length, 15);
  assert.equal(data.eras.classic.episodes, 45);
  assert.equal(data.eras.revived.episodes, 13);
  assert.equal(data.eras.classic.parts.length + data.eras.revived.parts.length, data.parts.length);
});

test('gives each Doctor the years of their run', () => {
  const byName = Object.fromEntries(data.doctors.map((d) => [d.name, d.years]));
  assert.equal(byName['Christopher Eccleston'], '2005');
  assert.equal(byName['David Tennant'], '2006–2008');
  assert.equal(years([{ airDate: '1963-11-23' }, { airDate: '1966-10-29' }]), '1963–1966');
});

test('places ratings on one scale for both eras, and votes per era on a log scale', () => {
  const blink = data.parts.find((p) => p.title === 'Blink');
  assert.equal(position(blink, 'rating', [4, 10], null), (blink.rating - 4) / 6);
  const [low, high] = data.eras.revived.votes;
  assert.equal(position({ votes: low }, 'votes', null, [low, high]), 0);
  assert.equal(position({ votes: high }, 'votes', null, [low, high]), 1);
  assert.equal(position({ rating: null }, 'rating', [4, 10], null), null);
});

test('a rating printed in a heatmap cell clears 4.5:1 on every colour of the scale, in both themes', () => {
  const tokens = readFileSync(new URL(import.meta.resolve('@mark-bugden/demo-kit/tokens.css')), 'utf8');
  const spectra = [...tokens.matchAll(/--chart-spectrum-1: (#\w+);\s*--chart-spectrum-2: (#\w+);\s*--chart-spectrum-3: (#\w+);\s*--chart-spectrum-4: (#\w+);/g)];
  assert.equal(spectra.length, 2); // dark, then light
  for (const [, ...stops] of spectra) {
    const scale = ramp(stops);
    for (let i = 0; i <= 100; i++) {
      const colour = scale(i / 100);
      assert.ok(contrast(colour, ink(colour)) >= 4.5, `${ink(colour)} on ${colour}`);
    }
  }
});

test('"How this works" gives the data\'s snapshot date', () => {
  assert.ok(manifest.about.includes(longDate(raw.snapshot)), `expected ${longDate(raw.snapshot)} in the manifest's about`);
});

test('the manifest\'s kit version matches the kit tag in package.json', () => {
  const pkg = read('../package.json');
  assert.equal(pkg.dependencies['@mark-bugden/demo-kit'], `github:Mark-Bugden/demo-kit#v${manifest.kitVersion}`);
});
