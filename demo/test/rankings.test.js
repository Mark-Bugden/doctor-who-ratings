import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { average, MIN_STORIES, rank, stories, sum } from '../src/rankings.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const raw = read('../public/data/episodes.json');
const fixtures = read('./fixtures/rankings.json');
const rated = stories(raw);

test('the fixtures come from the data file the demo loads', () => {
  assert.equal(fixtures.snapshot, raw.snapshot);
  assert.deepEqual(fixtures.columns, ['id', 'stories', 'average', 'score']);
  assert.equal(fixtures.cases.length, 54);
});

// Every subject and average, k = 0, 5 and 20, with and without era adjustment: the same ids in the
// same order, and the same numbers to the last bit.
for (const { subject, average: method, k, eraAdjusted, ranking } of fixtures.cases) {
  test(`matches the Python reference: ${subject}, ${method}, k = ${k}${eraAdjusted ? ', era-adjusted' : ''}`, () => {
    const rows = rank(rated, subject, { average: method, k, eraAdjusted }).map((row) => [row.id, row.stories, row.average, row.score]);
    assert.deepEqual(rows, ranking);
  });
}

test('sums floats as Python does', () => {
  // Plain addition gives 0.30000000000000004 and then 0.6000000000000001; Python's sum() gives 0.6.
  assert.equal(sum([0.1, 0.2, 0.3]), 0.6);
  assert.equal(sum([1e100, 1, -1e100]), 1);
  assert.equal(sum([]), 0);
});

test('averages', () => {
  assert.equal(average([1, 2, 6], [1, 1, 1], 'mean'), 3);
  assert.equal(average([1, 2, 6], [1, 0, 3], 'weighted'), 19 / 4);
  assert.equal(average([1, 2, 6], [1, 1, 1], 'median'), 2);
  assert.equal(average([1, 2, 6, 7], [1, 1, 1, 1], 'median'), 4);
  assert.throws(() => average([1], [1], 'mode'));
});

test('a story is the mean of its parts, and counts once', () => {
  const [story] = stories({
    stories: [{ id: 1, era: 'classic', doctor: 1, writers: [], directors: [] }],
    parts: [{ story: 1, rating: 6, votes: 100 }, { story: 1, rating: 8, votes: 300 }, { story: 1, rating: null, votes: null }],
  });
  assert.equal(story.rating, 7);
  assert.equal(story.weight, 200);
});

test('shrinkage pulls small samples towards the overall average', () => {
  const data = {
    stories: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ id, era: 'classic', doctor: id === 0 ? 1 : id < 5 ? 2 : 3, writers: [], directors: [] })),
    parts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ story: id, rating: id === 0 ? 9 : id < 5 ? 8.5 : 6, votes: 1 })),
  };
  // Overall mean 7.3. Doctor 1: one story at 9. Doctor 2: four at 8.5. Doctor 3: five at 6.
  const plain = rank(stories(data), 'doctor', { average: 'mean', k: 0 });
  assert.deepEqual(plain.map((row) => [row.id, row.score]), [[1, 9], [2, 8.5], [3, 6]]);
  const shrunk = rank(stories(data), 'doctor', { average: 'mean', k: 5 });
  assert.deepEqual(shrunk.map((row) => row.id), [2, 1, 3]);
});

test('every Doctor is ranked, and only writers and directors with 3 or more stories', () => {
  for (const subject of ['doctor', 'writer', 'director']) {
    const counts = new Map();
    for (const story of rated) for (const id of story[subject]) counts.set(id, (counts.get(id) ?? 0) + 1);
    const eligible = [...counts].filter(([, n]) => n >= MIN_STORIES[subject]).map(([id]) => id);
    assert.deepEqual(rank(rated, subject).map((row) => row.id).sort((a, b) => a - b), eligible.sort((a, b) => a - b));
  }
  assert.equal(rank(rated, 'doctor').length, raw.doctors.length);
});
