import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { prepare } from '../src/data.js';
import { suggestionDetail } from '../src/format.js';
import { find, matches, normalise, searchIndex, target } from '../src/search.js';

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

test('matches whole titles, then starts, then the start of a word, then anywhere', () => {
  const labels = (query) => matches(index, query, 50).map((entry) => entry.label);
  // "Heaven Sent" starts with the query; "Smile" has no word that does, so it isn't matched.
  assert.equal(labels('heaven')[0], 'Heaven Sent');
  const dalek = labels('dalek');
  assert.ok(dalek.indexOf('Dalek') < dalek.indexOf('The Daleks'), 'a title starting with the query comes first');
  assert.ok(dalek.indexOf('The Daleks') < dalek.indexOf('Remembrance of the Daleks'), 'stories in broadcast order');
  const cyber = labels('man');
  const word = cyber.findIndex((label) => / man/i.test(label));
  const inside = cyber.findIndex((label) => /\Bman/i.test(label) && !/(^| )man/i.test(label));
  assert.ok(word >= 0 && inside >= 0 && word < inside, 'the start of a word before the middle of one');
});

test('stops at the limit, and matches nothing for an empty query', () => {
  assert.equal(matches(index, 'the', 8).length, 8);
  assert.deepEqual(matches(index, '  '), []);
  assert.deepEqual(matches(index, 'no such episode'), []);
});

test('indexes each named part, and no generic part titles', () => {
  const labels = index.map((entry) => entry.label);
  assert.ok(!labels.includes('Part One'));
  assert.ok(!labels.includes('Episode 1'));
  assert.ok(labels.includes('The Cave of Skulls'));
});

test('describes each suggestion: where it sits, the Doctor, and when', () => {
  const [skulls] = matches(index, 'The Cave of Skulls', 1);
  assert.equal(suggestionDetail(target(skulls)), 'An Unearthly Child, part 2 · William Hartnell · 1963');
  const [blink] = matches(index, 'Blink', 1);
  assert.equal(suggestionDetail(target(blink)), 'David Tennant · 2007');
  const [daleks] = matches(index, 'The Daleks', 1);
  assert.equal(suggestionDetail(target(daleks)), '7 episodes · William Hartnell · 1963–64');
});
