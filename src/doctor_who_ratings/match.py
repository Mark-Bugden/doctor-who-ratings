"""Match each part in reference/parts.csv to its IMDb episode, and fill in its imdb_id.

Within each season, a part matches the IMDb episode whose title is the part's title, or the
story's title and the part's, as in "Spearhead from Space: Episode 1". IMDb episodes that Wikipedia
lists as specials are skipped. Parts left over are paired with the leftover episodes in broadcast
order and reported, so they can be checked by hand. Parts that already have an imdb_id keep it.

    uv run python -m doctor_who_ratings.match
"""

import re
import sys
import unicodedata
from collections import defaultdict

from . import imdb, reference

# Where IMDb files each era's seasons: (parent, offset), so season s is IMDb's season s - offset.
# IMDb files the seasons from 2024 onwards under a separate parent, numbered from 1 again.
SEASONS = {
    "classic": [("tt0056751", 0)],
    "revived": [("tt0436992", 0), ("tt31433814", 13)],
}

# Specials, as Wikipedia lists them, that IMDb files as a numbered episode within a season. IMDb
# gives its other specials no season, or episode 0 within one.
SPECIALS_IN_SEASONS = ["The Five Doctors", "The Snowmen"]


def normalise(title):
    title = unicodedata.normalize("NFKD", title.replace("æ", "ae").replace("Æ", "Ae"))
    title = title.lower().replace("&", "and")
    title = re.sub(r"[^a-z0-9 ]", " ", title)
    return " ".join(title.split())


def imdb_seasons():
    """IMDb's regular episodes for each (era, season), in IMDb's order, with duplicates removed."""
    basics = {row["tconst"]: row for row in imdb.read("title.basics")}
    seasons = defaultdict(list)
    for row in imdb.read("title.episode"):
        if not row["seasonNumber"] or not row["episodeNumber"] or row["episodeNumber"] == "0":
            continue  # IMDb's specials: no season, or episode 0 within one
        for era, parents in SEASONS.items():
            for parent, offset in parents:
                if row["parentTconst"] == parent:
                    basic = basics[row["tconst"]]
                    seasons[(era, int(row["seasonNumber"]) + offset)].append(
                        {
                            "imdb_id": row["tconst"],
                            "number": int(row["episodeNumber"]),
                            "title": basic["primaryTitle"],
                            "year": basic["startYear"],
                        }
                    )
    for key, episodes in seasons.items():
        episodes.sort(key=lambda episode: episode["number"])
        kept, seen = [], {}
        for episode in episodes:
            same = (normalise(episode["title"]), episode["year"])
            if same in seen:
                print(f"  duplicate on IMDb: {episode['imdb_id']} repeats {seen[same]['imdb_id']} ({episode['title']})")
            else:
                seen[same] = episode
                kept.append(episode)
        seasons[key] = kept
    return seasons


def match(parts, stories, seasons, specials):
    """Fill in imdb_id where it's missing. Returns the pairs that matched only by position."""
    titles = {story["story"]: story["title"] for story in stories}
    taken = {part["imdb_id"] for part in parts if part["imdb_id"]}
    by_position = []
    groups = defaultdict(list)
    for part in parts:
        groups[(part["era"], part["season"])].append(part)

    for key, group in groups.items():
        episodes = [
            episode
            for episode in seasons.get(key, [])
            if episode["imdb_id"] not in taken and normalise(episode["title"]) not in specials
        ]
        index = defaultdict(list)
        for episode in episodes:
            index[normalise(episode["title"])].append(episode)
        left = []
        for part in group:
            if part["imdb_id"]:
                continue
            story = titles[part["story"]]
            names = {normalise(part["title"]), normalise(f"{story}: {part['title']}")}
            found = [episode for name in names for episode in index.get(name, []) if episode["imdb_id"] not in taken]
            if len(found) == 1:
                part["imdb_id"] = found[0]["imdb_id"]
                taken.add(part["imdb_id"])
            else:
                left.append(part)
        spare = [episode for episode in episodes if episode["imdb_id"] not in taken]
        for part, episode in zip(left, spare):
            part["imdb_id"] = episode["imdb_id"]
            taken.add(episode["imdb_id"])
            by_position.append((part, episode))
    return by_position


def main():
    stories, parts = reference.stories(), reference.parts()
    seasons = imdb_seasons()
    specials = {normalise(title) for title in SPECIALS_IN_SEASONS}
    by_position = match(parts, stories, seasons, specials)
    reference.write("parts.csv", reference.PART_COLUMNS, parts)

    for part, episode in by_position:
        print(f"  by position: {part['era']} {part['season']}.{part['episode']} {part['title']!r} -> {episode['imdb_id']} {episode['title']!r}")
    unmatched = [part for part in parts if not part["imdb_id"]]
    for part in unmatched:
        print(f"  no IMDb episode: {part['era']} {part['season']}.{part['episode']} {part['title']!r}")
    taken = {part["imdb_id"] for part in parts}
    for (era, season), episodes in sorted(seasons.items()):
        for episode in episodes:
            if episode["imdb_id"] not in taken:
                print(f"  IMDb episode not matched: {era} {season} #{episode['number']} {episode['imdb_id']} {episode['title']!r}")
    print(f"{len(parts) - len(unmatched)} of {len(parts)} parts matched, {len(by_position)} by position only.")


if __name__ == "__main__":
    sys.exit(main())
