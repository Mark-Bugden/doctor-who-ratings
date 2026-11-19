// Title search: finds a story or an episode by its title. No DOM access.

import { isGeneric } from './format.js';

/** Lower case, without accents or punctuation, so "The Dæmons" matches "the daemons". */
export function normalise(text) {
  return text
    .replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The searchable titles: every story's, then every part's that names the part on its own. Stories
 * come first, so a title that is both, such as "The Daleks", finds the story.
 */
export function searchIndex(stories) {
  const entries = stories.map((story) => ({ label: story.title, key: normalise(story.title), story }));
  for (const story of stories) {
    for (const part of story.parts) {
      if (!isGeneric(part.title) && part.title !== story.title) {
        entries.push({ label: part.title, key: normalise(part.title), story, part });
      }
    }
  }
  return entries;
}

// How well a title matches a query, best first: the whole title, its start, the start of a word in
// it, or anywhere in it.
function closeness(key, query) {
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  if (key.includes(` ${query}`)) return 2;
  if (key.includes(query)) return 3;
  return null;
}

/**
 * The titles that match a query, best first, up to `limit` of them. Within each degree of match,
 * stories come before parts, each in broadcast order.
 */
export function matches(index, query, limit = 8) {
  const key = normalise(query ?? '');
  if (!key) return [];
  const ranked = [[], [], [], []];
  for (const entry of index) {
    const rank = closeness(entry.key, key);
    if (rank !== null) ranked[rank].push(entry);
  }
  return ranked.flat().slice(0, limit);
}

/** What a match finds, as { story, part }. A story of one episode is found as that episode. */
export function target(entry) {
  const { story } = entry;
  return { story, part: entry.part ?? (story.parts.length === 1 ? story.parts[0] : null) };
}

/** The best match for a query, as { story, part }, or null. */
export function find(index, query) {
  const [entry] = matches(index, query, 1);
  return entry ? target(entry) : null;
}
