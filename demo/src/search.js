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

/** The labels to suggest, each once. */
export function suggestions(index) {
  return [...new Set(index.map((entry) => entry.label))];
}

/**
 * The best match for a query, as { story, part }: an exact title, then a title that starts with the
 * query, then one that contains it. A story of one episode is found as that episode.
 */
export function find(index, query) {
  const key = normalise(query ?? '');
  if (!key) return null;
  const entry = index.find((e) => e.key === key)
    ?? index.find((e) => e.key.startsWith(key))
    ?? index.find((e) => e.key.includes(key));
  if (!entry) return null;
  const { story } = entry;
  return { story, part: entry.part ?? (story.parts.length === 1 ? story.parts[0] : null) };
}
