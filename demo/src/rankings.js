// The leaderboard's maths, mirroring src/doctor_who_ratings/rankings.py, which is the reference.
// test/rankings.test.js checks this against the fixtures the Python writes. No DOM access.
//
// A story's rating is the mean of its parts' ratings, and its vote weight is the mean number of
// votes per part, so a six-part serial counts once. Parts without a rating are left out of both.
//
// A subject (a Doctor, writer or director) scores
//
//     (k·m + n·x̄) / (k + n)
//
// where x̄ is the subject's average over its n stories, m is the same average over all stories, and
// k is the shrinkage strength. The average is the plain mean, the vote-weighted mean or the median
// of story ratings. With era adjustment on, each story's rating is first replaced by its difference
// from its era's average, computed the same way. A co-written story counts in full for each writer,
// and writers and directors need at least 3 stories to be ranked.

export const SUBJECTS = ['doctor', 'writer', 'director'];
export const AVERAGES = ['mean', 'weighted', 'median'];
export const MIN_STORIES = { doctor: 1, writer: 3, director: 3 };
export const DEFAULTS = { average: 'weighted', k: 5, eraAdjusted: false };

/**
 * Python's sum() of floats: Neumaier's compensated summation, which Python uses from 3.12. Adding
 * the same way keeps the scores identical to the reference, not just close.
 */
export function sum(values) {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const next = total + value;
    compensation += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + compensation;
}

/** Each story with a rating, from the demo's data file: its rating, vote weight, era and people. */
export function stories(data) {
  const rated = new Map();
  for (const part of data.parts) {
    if (part.rating == null) continue;
    if (!rated.has(part.story)) rated.set(part.story, []);
    rated.get(part.story).push(part);
  }
  const result = [];
  for (const story of data.stories) {
    const parts = rated.get(story.id);
    if (!parts) continue;
    result.push({
      id: story.id,
      era: story.era,
      doctor: [story.doctor],
      writer: story.writers,
      director: story.directors,
      rating: sum(parts.map((part) => part.rating)) / parts.length,
      weight: sum(parts.map((part) => part.votes)) / parts.length,
    });
  }
  return result;
}

export function average(values, weights, method) {
  if (method === 'mean') return sum(values) / values.length;
  if (method === 'weighted') return sum(values.map((value, i) => weights[i] * value)) / sum(weights);
  if (method === 'median') {
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }
  throw new Error(`unknown average: ${method}`);
}

/** Each story's value to average, its rating or with era adjustment its difference from its era's average, and its weight. */
function adjust(stories, method, eraAdjusted) {
  const weights = stories.map((story) => story.weight);
  if (!eraAdjusted) return { values: stories.map((story) => story.rating), weights };
  const eras = new Map();
  for (const story of stories) {
    if (!eras.has(story.era)) eras.set(story.era, [[], []]);
    eras.get(story.era)[0].push(story.rating);
    eras.get(story.era)[1].push(story.weight);
  }
  const baseline = new Map([...eras].map(([era, columns]) => [era, average(...columns, method)]));
  return { values: stories.map((story) => story.rating - baseline.get(story.era)), weights };
}

/** m: the average over all stories, which shrinkage pulls every score towards. */
export function overall(stories, { average: method = DEFAULTS.average, eraAdjusted = DEFAULTS.eraAdjusted } = {}) {
  const { values, weights } = adjust(stories, method, eraAdjusted);
  return average(values, weights, method);
}

/** The ranked subjects, best first, as { id, stories (n), average (x̄), score }. */
export function rank(stories, subject, { average: method = DEFAULTS.average, k = DEFAULTS.k, eraAdjusted = DEFAULTS.eraAdjusted } = {}) {
  const { values, weights } = adjust(stories, method, eraAdjusted);
  const overall = average(values, weights, method);

  const members = new Map(); // subject id -> indices of its stories
  stories.forEach((story, index) => {
    for (const id of story[subject]) {
      if (!members.has(id)) members.set(id, []);
      members.get(id).push(index);
    }
  });

  const ranking = [];
  for (const [id, indices] of members) {
    const n = indices.length;
    if (n < MIN_STORIES[subject]) continue;
    const mean = average(indices.map((i) => values[i]), indices.map((i) => weights[i]), method);
    ranking.push({ id, stories: n, average: mean, score: (k * overall + n * mean) / (k + n) });
  }
  return ranking.sort((a, b) => b.score - a.score || a.id - b.id);
}
