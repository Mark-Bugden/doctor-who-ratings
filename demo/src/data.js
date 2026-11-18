// Indexes the demo's data file (public/data/episodes.json) for the views: each part with its story
// and Doctor, each story with its parts, each Doctor's run, and the eras' seasons. No DOM access.

export const ERAS = {
  classic: { label: 'Classic', season: 'Season' },
  revived: { label: 'Revived', season: 'Series' },
};

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Milliseconds since the epoch for an ISO date, at midnight UTC. */
export const time = (iso) => Date.parse(`${iso}T00:00:00Z`);

export function prepare(data) {
  const doctors = new Map(data.doctors.map((doctor) => [doctor.id, { ...doctor, stories: [], parts: [] }]));
  const stories = new Map(data.stories.map((story) => [story.id, {
    ...story,
    doctor: doctors.get(story.doctor),
    writers: story.writers.map((id) => data.people[id]),
    directors: story.directors.map((id) => data.people[id]),
    parts: [],
  }]));

  const parts = data.parts.map((part, index) => {
    const story = stories.get(part.story);
    const prepared = { ...part, index, story, era: story.era, time: time(part.airDate), number: story.parts.length + 1 };
    story.parts.push(prepared);
    return prepared;
  });

  for (const story of stories.values()) {
    const rated = story.parts.filter((part) => part.rating != null);
    story.rating = rated.length ? mean(rated.map((part) => part.rating)) : null;
    story.votes = rated.length ? mean(rated.map((part) => part.votes)) : null;
    story.season = story.parts[0].season;
    story.doctor.stories.push(story);
    story.doctor.parts.push(...story.parts);
  }

  const eras = {};
  for (const era of Object.keys(ERAS)) {
    const own = parts.filter((part) => part.era === era);
    const seasons = [...new Set(own.map((part) => part.season))].sort((a, b) => a - b);
    eras[era] = {
      ...ERAS[era],
      id: era,
      parts: own,
      seasons: seasons.map((season) => {
        const inSeason = own.filter((part) => part.season === season);
        return { season, parts: inSeason, years: years(inSeason) };
      }),
      episodes: Math.max(...own.map((part) => part.episode)),
      votes: extent(own.map((part) => part.votes).filter((votes) => votes != null)),
    };
  }

  for (const doctor of doctors.values()) doctor.years = years(doctor.parts);

  return {
    snapshot: data.snapshot,
    doctors: [...doctors.values()],
    stories: [...stories.values()],
    parts,
    eras,
    ratings: extent(parts.map((part) => part.rating).filter((rating) => rating != null)),
    votes: extent(parts.map((part) => part.votes).filter((votes) => votes != null)),
  };
}

export function extent(values) {
  return [Math.min(...values), Math.max(...values)];
}

/** The calendar years a run of parts spans, e.g. "2005" or "2006–2008". */
export function years(parts) {
  const first = parts[0].airDate.slice(0, 4);
  const last = parts[parts.length - 1].airDate.slice(0, 4);
  return first === last ? first : `${first}–${last}`;
}
