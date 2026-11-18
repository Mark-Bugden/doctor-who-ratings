import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { prepare } from '../src/data.js';
import { find, normalise, searchIndex, suggestions } from '../src/search.js';

const data = prepare(JSON.parse(readFileSync(new URL('../public/data/episodes.json', import.meta.url), 'utf8')));
const index = searchIndex(data.stories);

test('normalises titles for matching', () => {
  assert.equal(normalise('The Dæmons'), 'the daemons');
  assert.equal(normalise("  The Daleks' Master Plan "), 'the daleks master plan');
  assert.equal(normalise('Love & Monsters'), 'love and monsters');
});

test('finds a story by its exact title, before a part with the same title', () => {
  // "The Daleks" is story 2, and also part 2 of The Dalek Invasion of Earth.
  const found = find(index, 'the daleks');
  assert.equal(found.story.title, 'The Daleks');
  assert.equal(found.part, null);
});

test('finds a story of one episode as that episode', () => {
  const found = find(index, 'Blink');
  assert.equal(found.part.title, 'Blink');
});

test('finds a named part of a story', () => {
  const found = find(index, 'The Cave of Skulls');
  assert.equal(found.story.title, 'An Unearthly Child');
  assert.equal(found.part.number, 2);
});

test('falls back to a title that starts with, then contains, the query', () => {
  assert.equal(find(index, 'heaven').part.title, 'Heaven Sent');
  assert.equal(find(index, 'weng').story.title, 'The Talons of Weng-Chiang');
  assert.equal(find(index, 'no such episode'), null);
  assert.equal(find(index, '  '), null);
});

test('suggests each title once, and no generic part titles', () => {
  const labels = suggestions(index);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(!labels.includes('Part One'));
  assert.ok(!labels.includes('Episode 1'));
  assert.ok(labels.includes('The Cave of Skulls'));
});
