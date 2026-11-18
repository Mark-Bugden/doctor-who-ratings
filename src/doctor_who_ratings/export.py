"""Join the reference tables with IMDb's ratings, and write the demo's data and the rankings fixtures.

Reads reference/stories.csv and parts.csv (committed) and the extracted IMDb rows in data/interim/
(from `python -m doctor_who_ratings.imdb`). Writes:

- demo/public/data/episodes.json: the snapshot date, the Doctors in order, people by id, the stories
  and their parts, with only the fields the demo's views need.
- demo/test/fixtures/rankings.json: the rankings reference for a grid of settings, for the JS tests.

    uv run python -m doctor_who_ratings.export
"""

import json
import sys

from . import imdb, rankings, reference
from .paths import EXPORT, FIXTURES

FIXTURE_SHRINKAGE = [0, 5, 20]


def build(stories, parts, ratings, snapshot):
    """The demo's data, as a dict."""
    actors = {actor: number for number, _, actor in reference.DOCTORS}
    people = {}  # name -> id, in order of first credit
    for story in stories:
        for name in story["writers"] + story["directors"]:
            people.setdefault(name, len(people))
    return {
        "snapshot": snapshot,
        "doctors": [
            {"id": number, "name": actor, "label": heading}
            for number, heading, actor in reference.DOCTORS
            if any(story["doctor"] == actor for story in stories)
        ],
        "people": list(people),
        "stories": [
            {
                "id": int(story["story"]),
                "title": story["title"],
                "era": story["era"],
                "doctor": actors[story["doctor"]],
                "writers": [people[name] for name in story["writers"]],
                "directors": [people[name] for name in story["directors"]],
            }
            for story in stories
        ],
        "parts": [
            {
                "story": int(part["story"]),
                "season": part["season"],
                "episode": part["episode"],
                "title": part["title"],
                "airDate": part["air_date"],
                "rating": ratings.get(part["imdb_id"], (None, None))[0],
                "votes": ratings.get(part["imdb_id"], (None, None))[1],
            }
            for part in parts
        ],
    }


def fixtures(data):
    """The rankings for every subject and average, a few shrinkage strengths, with and without eras."""
    rated = rankings.stories(data)
    cases = []
    for subject in rankings.SUBJECTS:
        for method in rankings.AVERAGES:
            for k in FIXTURE_SHRINKAGE:
                for era_adjusted in [False, True]:
                    ranking = rankings.rank(rated, subject, method, k, era_adjusted)
                    cases.append(
                        {
                            "subject": subject,
                            "average": method,
                            "k": k,
                            "eraAdjusted": era_adjusted,
                            "ranking": [[row["id"], row["stories"], row["average"], row["score"]] for row in ranking],
                        }
                    )
    return {"snapshot": data["snapshot"], "columns": ["id", "stories", "average", "score"], "cases": cases}


def dumps(data):
    """JSON with one record per line, so a refresh shows up as a readable diff."""
    lines = []
    for key, value in data.items():
        if isinstance(value, list):
            records = ",\n    ".join(json.dumps(item, ensure_ascii=False, separators=(",", ":")) for item in value)
            lines.append(f'  "{key}": [\n    {records}\n  ]')
        else:
            lines.append(f"  {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)}")
    return "{\n" + ",\n".join(lines) + "\n}\n"


def main():
    ratings = {row["tconst"]: (float(row["averageRating"]), int(row["numVotes"])) for row in imdb.read("title.ratings")}
    data = build(reference.stories(), reference.parts(), ratings, imdb.snapshot_date())
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text(dumps(data), encoding="utf-8", newline="\n")
    print(f"{EXPORT.relative_to(EXPORT.parents[3])}: {EXPORT.stat().st_size / 1000:.1f} KB")

    # The fixtures come from the file just written, which is all the JS will have.
    data = json.loads(EXPORT.read_text(encoding="utf-8"))
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / "rankings.json"
    path.write_text(dumps(fixtures(data)), encoding="utf-8", newline="\n")
    print(f"{path.relative_to(EXPORT.parents[3])}: {path.stat().st_size / 1000:.1f} KB")


if __name__ == "__main__":
    sys.exit(main())
