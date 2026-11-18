"""Compare each story's writers and directors on Wikipedia with IMDb's credits for its parts.

The reference tables take their credits from Wikipedia. This report shows where IMDb differs, and,
from title.principals, what IMDb's extra credits are (such as "created by").

    uv run python -m doctor_who_ratings.credits
"""

import sys
from collections import Counter, defaultdict

from . import imdb, reference
from .match import normalise


def imdb_credits(parts):
    """IMDb's writers and directors for each story, as names, and the jobs of each credit."""
    names = {row["nconst"]: row["primaryName"] for row in imdb.read("name.basics")}
    crew = {row["tconst"]: row for row in imdb.read("title.crew")}
    jobs = defaultdict(set)  # (story, name) -> jobs listed in title.principals
    story_of = {part["imdb_id"]: part["story"] for part in parts}
    for row in imdb.read("title.principals"):
        if row["tconst"] in story_of and row["category"] in ("writer", "director"):
            jobs[(story_of[row["tconst"]], names.get(row["nconst"]))].add(row["job"] or row["category"])

    credits = defaultdict(lambda: {"writers": set(), "directors": set()})
    for part in parts:
        row = crew[part["imdb_id"]]
        for column in ["writers", "directors"]:
            for person in (row[column] or "").split(","):
                if person:
                    credits[part["story"]][column].add(names.get(person, person))
    return credits, jobs


def main():
    stories, parts = reference.stories(), reference.parts()
    credits, jobs = imdb_credits(parts)
    for column in ["writers", "directors"]:
        extra, missing, agree = Counter(), Counter(), 0
        extra_jobs = defaultdict(Counter)
        for story in stories:
            ours = {normalise(name): name for name in story[column]}
            theirs = {normalise(name): name for name in credits[story["story"]][column]}
            if ours.keys() == theirs.keys():
                agree += 1
            for key in theirs.keys() - ours.keys():
                extra[theirs[key]] += 1
                for job in jobs.get((story["story"], theirs[key]), {"(not in title.principals)"}):
                    extra_jobs[theirs[key]][job] += 1
            for key in ours.keys() - theirs.keys():
                missing[ours[key]] += 1
        print(f"{column}: IMDb agrees with Wikipedia on {agree} of {len(stories)} stories.")
        print(f"  On IMDb but not Wikipedia ({sum(extra.values())} credits):")
        for name, count in extra.most_common():
            print(f"    {name}: {count} stories; jobs: {dict(extra_jobs[name])}")
        print(f"  On Wikipedia but not IMDb ({sum(missing.values())} credits):")
        for name, count in missing.most_common():
            print(f"    {name}: {count} stories")


if __name__ == "__main__":
    sys.exit(main())
