// The words the demo shows: dates, numbers, credits, and the descriptions in the tooltip and the
// status line. No DOM access.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NUMBER = new Intl.NumberFormat('en-GB');

/** "23 Nov 1963" from "1963-11-23". */
export function date(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "18 November 2026" from "2026-11-18". */
export function longDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${LONG_MONTHS[month - 1]} ${year}`;
}

export const count = (n) => NUMBER.format(Math.round(n));
export const rating = (value) => (value == null ? 'no rating' : value.toFixed(1));

/** "A", "A and B", "A, B and C". */
export function list(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function plural(n, one, many = `${one}s`) {
  return `${count(n)} ${n === 1 ? one : many}`;
}

// Part titles that say nothing on their own, such as "Part Six", "Episode 4" or "One".
const GENERIC = /^(?:(?:part|episode|chapter)\b.*|one|two|three|four|five|six|seven|eight|nine|ten)$/i;
export const isGeneric = (title) => GENERIC.test(title);

/** Where a part sits in its story, e.g. "An Unearthly Child, part 2 of 4", or null for a story of one part. */
export function partOf(part) {
  const { story } = part;
  return story.parts.length > 1 ? `${story.title}, part ${part.number} of ${story.parts.length}` : null;
}

/** An episode's name: its own title, or for a part titled "Part Six" and the like, its story's and its number. */
export function episodeName(part) {
  return isGeneric(part.title) ? `${part.story.title}, part ${part.number}` : part.title;
}

/** The lines of the tooltip for a clicked or found part. A generic part title gives way to its story's. */
export function partLines(part) {
  const { story } = part;
  const generic = isGeneric(part.title);
  const of = story.parts.length > 1 ? `part ${part.number} of ${story.parts.length}` : null;
  return [
    generic ? story.title : part.title,
    of && (generic ? `Part ${part.number} of ${story.parts.length}` : `${story.title}, ${of}`),
    `${story.doctor.name} · ${date(part.airDate)}`,
    part.rating == null ? 'No rating' : `Rated ${rating(part.rating)} · ${plural(part.votes, 'vote')}`,
    credits(story),
  ].filter(Boolean);
}

/** The dates a story aired, e.g. "13 Nov 1965 – 29 Jan 1966". */
export function span(story) {
  const first = story.parts[0].airDate;
  const last = story.parts.at(-1).airDate;
  return first === last ? date(first) : `${date(first)} – ${date(last)}`;
}

/** The lines of the tooltip for a whole story. */
export function storyLines(story) {
  return [
    story.title,
    `${plural(story.parts.length, 'episode')} · ${span(story)}`,
    story.doctor.name,
    story.rating == null ? 'No rating' : `Story rating ${rating(story.rating)} · ${count(story.votes)} votes per episode`,
    credits(story),
  ];
}

export function credits(story) {
  return `Written by ${list(story.writers)}. Directed by ${list(story.directors)}.`;
}

/** The status line for a Doctor: their run, and their highest-rated episode. */
export function doctorStatus(doctor) {
  const best = doctor.parts.reduce((a, b) => ((b.rating ?? -1) > (a.rating ?? -1) ? b : a));
  return `${doctor.name}, the ${doctor.label}: ${plural(doctor.parts.length, 'episode')} in ${plural(doctor.stories.length, 'story', 'stories')}, ${doctor.years}. Highest rated: ${episodeName(best)}, ${rating(best.rating)}.`;
}

/** The name of a search result or a clicked episode, as the search box shows it. */
export function foundName({ story, part }) {
  return part ? episodeName(part) : story.title;
}

/** The second line of a search suggestion: where the title sits, the Doctor, and when, e.g. "An Unearthly Child, part 2 · William Hartnell · 1963". */
export function suggestionDetail({ story, part }) {
  if (part) {
    const where = story.parts.length > 1 ? `${story.title}, part ${part.number}` : null;
    return [where, story.doctor.name, part.airDate.slice(0, 4)].filter(Boolean).join(' · ');
  }
  const first = story.parts[0].airDate.slice(0, 4);
  const last = story.parts.at(-1).airDate.slice(0, 4);
  const when = first === last ? first : `${first}–${last.slice(first.slice(0, 2) === last.slice(0, 2) ? 2 : 0)}`;
  return [plural(story.parts.length, 'episode'), story.doctor.name, when].join(' · ');
}

/** The status line for a search result or a clicked episode. */
export function foundStatus({ story, part }) {
  if (part) {
    const where = partOf(part);
    const name = isGeneric(part.title) ? where : `${part.title}${where ? ` (${where})` : ''}`;
    return `${name}: ${story.doctor.name}, ${date(part.airDate)}. ${part.rating == null ? 'No rating.' : `Rated ${rating(part.rating)} from ${plural(part.votes, 'vote')}.`}`;
  }
  return `${story.title}: ${story.doctor.name}, ${plural(story.parts.length, 'episode')}, ${span(story)}. ${story.rating == null ? 'No rating.' : `Story rating ${rating(story.rating)}.`}`;
}

// The leaderboard.

const SUBJECT_NAMES = { doctor: ['Doctor', 'Doctors'], writer: ['writer', 'writers'], director: ['director', 'directors'] };

/** A score: a rating such as "8.06", or with era adjustment a difference such as "+0.40" or "−0.12". */
export function score(value, eraAdjusted) {
  const text = Math.abs(value).toFixed(2);
  if (!eraAdjusted) return value.toFixed(2);
  return text === '0.00' ? text : `${value > 0 ? '+' : '−'}${text}`;
}

/** A tick on the score axis: "7.5", or with era adjustment "+0.5", "0" or "−0.5". */
export function scoreTick(value, eraAdjusted) {
  if (!eraAdjusted || value === 0) return String(value);
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}

/** The shrinkage slider's value: "None", "1 story", "5 stories". */
export const shrinkage = (k) => (k === 0 ? 'None' : plural(k, 'story', 'stories'));

/** The note above the leaderboard: who is ranked. */
export function boardNote(subject, minimum) {
  if (subject === 'doctor') return 'Doctors, best first.';
  if (subject === 'writer') return `Writers with ${minimum} or more stories, best first. A co-written story counts for each writer.`;
  return `Directors with ${minimum} or more stories, best first.`;
}

/** The leaderboard's status line: the top three and their scores. */
export function topThree(ranking, name, subject, eraAdjusted) {
  const [one, many] = SUBJECT_NAMES[subject];
  const top = ranking.slice(0, 3).map((row) => `${name(row.id)} ${score(row.score, eraAdjusted)}`);
  return `Top three of ${plural(ranking.length, one, many)}${eraAdjusted ? ', compared with their era’s average' : ''}: ${list(top)}.`;
}

/** The leaderboard for screen readers: every row in order, with its score. */
export function boardLabel(ranking, name, subject, eraAdjusted) {
  const rows = ranking.map((row, i) => `${i + 1}. ${name(row.id)}, ${score(row.score, eraAdjusted)}`);
  return `Leaderboard of ${SUBJECT_NAMES[subject][1]}, best first${eraAdjusted ? ', compared with their era’s average' : ''}: ${rows.join('; ')}.`;
}
