"""The hand-checked tables in reference/: one row per story, and one per part.

A story is a story as Wikipedia numbers it: a classic serial, a modern single episode, or a modern
multi-parter, such as "Aliens of London" and "World War Three" (story 160). Only regular episodes
are included. Specials, as Wikipedia lists them, are left out.
"""

import csv

from .paths import REFERENCE

# The Doctors in order: their number, the heading Wikipedia files their episodes under, and the
# actor. With the specials left out, the Eighth, War and Fourteenth Doctors have no stories, so
# they don't appear here.
DOCTORS = [
    (1, "First Doctor", "William Hartnell"),
    (2, "Second Doctor", "Patrick Troughton"),
    (3, "Third Doctor", "Jon Pertwee"),
    (4, "Fourth Doctor", "Tom Baker"),
    (5, "Fifth Doctor", "Peter Davison"),
    (6, "Sixth Doctor", "Colin Baker"),
    (7, "Seventh Doctor", "Sylvester McCoy"),
    (9, "Ninth Doctor", "Christopher Eccleston"),
    (10, "Tenth Doctor", "David Tennant"),
    (11, "Eleventh Doctor", "Matt Smith"),
    (12, "Twelfth Doctor", "Peter Capaldi"),
    (13, "Thirteenth Doctor", "Jodie Whittaker"),
    (15, "Fifteenth Doctor", "Ncuti Gatwa"),
]
ACTORS = {heading: actor for _, heading, actor in DOCTORS}

ERAS = ["classic", "revived"]

STORY_COLUMNS = ["story", "era", "season", "doctor", "title", "writers", "directors"]
PART_COLUMNS = ["story", "part", "era", "season", "episode", "title", "air_date", "imdb_id"]
PEOPLE_SEPARATOR = "; "  # between the people in the writers and directors columns


def write(name, columns, rows):
    REFERENCE.mkdir(exist_ok=True)
    with open(REFERENCE / name, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, columns, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: _cell(row.get(key)) for key in columns})


def _cell(value):
    if value is None:
        return ""
    if isinstance(value, list):
        return PEOPLE_SEPARATOR.join(value)
    return value


def _read(name):
    with open(REFERENCE / name, encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def stories():
    """The stories, in broadcast order, with their people as lists."""
    rows = _read("stories.csv")
    for row in rows:
        row["season"] = int(row["season"])
        for column in ["writers", "directors"]:
            row[column] = row[column].split(PEOPLE_SEPARATOR) if row[column] else []
    return rows


def parts():
    """The parts, in broadcast order. A part without a matched IMDb episode has imdb_id None."""
    rows = _read("parts.csv")
    for row in rows:
        for column in ["part", "season", "episode"]:
            row[column] = int(row[column])
        row["imdb_id"] = row["imdb_id"] or None
    return rows
