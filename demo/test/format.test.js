import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { prepare } from '../src/data.js';
import * as describe from '../src/format.js';
import { linear, log, logTicks, ticks, yearTicks } from '../src/scale.js';

const data = prepare(JSON.parse(readFileSync(new URL('../public/data/episodes.json', import.meta.url), 'utf8')));
const story = (title) => data.stories.find((s) => s.title === title);

test('formats dates and lists', () => {
  assert.equal(describe.date('1963-11-23'), '23 Nov 1963');
  assert.equal(describe.longDate('2026-11-18'), '18 November 2026');
  assert.equal(describe.list(['A']), 'A');
  assert.equal(describe.list(['A', 'B', 'C']), 'A, B and C');
  assert.equal(describe.plural(1, 'story', 'stories'), '1 story');
  assert.equal(describe.plural(1500, 'vote'), '1,500 votes');
});

test('names a part titled "Part Six" by its story', () => {
  const talons = story('The Talons of Weng-Chiang');
  assert.equal(describe.episodeName(talons.parts[5]), 'The Talons of Weng-Chiang, part 6');
  assert.equal(describe.episodeName(story('An Unearthly Child').parts[1]), 'The Cave of Skulls');
  const [title, of] = describe.partLines(talons.parts[5]);
  assert.equal(title, 'The Talons of Weng-Chiang');
  assert.equal(of, 'Part 6 of 6');
  assert.equal(describe.partLines(story('An Unearthly Child').parts[1])[1], 'An Unearthly Child, part 2 of 4');
});

test('describes a found story with its dates', () => {
  const text = describe.foundStatus({ story: story("The Daleks' Master Plan"), part: null });
  assert.match(text, /^The Daleks' Master Plan: William Hartnell, 12 episodes, 13 Nov 1965 – 29 Jan 1966\. Story rating \d\.\d\.$/);
});

test('describes a Doctor with their highest-rated episode', () => {
  const tennant = data.doctors.find((d) => d.name === 'David Tennant');
  assert.match(describe.doctorStatus(tennant), /^David Tennant, the Tenth Doctor: 39 episodes in 29 stories, 2006–2008\. Highest rated: Blink, 9\.\d\.$/);
});

test('scales and ticks', () => {
  assert.equal(linear([0, 10], [0, 100])(2.5), 25);
  assert.equal(log([10, 1000], [0, 2])(100), 1);
  assert.deepEqual(ticks(4, 10, 6), [4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(ticks(4, 10, 3), [4, 6, 8, 10]);
  assert.deepEqual(logTicks(300, 30000), [500, 1000, 2000, 5000, 10000, 20000]);
  assert.deepEqual(yearTicks(1963, 2025, 620), [1970, 1980, 1990, 2000, 2010, 2020]);
});
