"""The leaderboard's maths: the reference that the demo's rankings.js is tested against.

A story's rating is the mean of its parts' ratings, and its vote weight is the mean number of
votes per part, so a six-part serial counts once. Parts without a rating are left out of both.

A subject (a Doctor, writer or director) scores

    (k·m + n·x̄) / (k + n)

where x̄ is the subject's average over its n stories, m is the same average over all stories, and k
is the shrinkage strength. The average is the plain mean, the vote-weighted mean or the median of
story ratings. With era adjustment on, each story's rating is first replaced by its difference
from its era's average, computed the same way. A co-written story counts in full for each writer,
and writers and directors need at least 3 stories to be ranked.

Everything here works on the demo's data file, so the JS can compute exactly the same numbers.
"""

SUBJECTS = ("doctor", "writer", "director")
AVERAGES = ("mean", "weighted", "median")
MIN_STORIES = {"doctor": 1, "writer": 3, "director": 3}


def stories(data):
    """Each story with a rating, from the demo's data: its rating, vote weight, era and people."""
    rated = {}
    for part in data["parts"]:
        if part["rating"] is not None:
            rated.setdefault(part["story"], []).append(part)
    result = []
    for story in data["stories"]:
        parts = rated.get(story["id"])
        if not parts:
            continue
        result.append(
            {
                "id": story["id"],
                "era": story["era"],
                "doctor": [story["doctor"]],
                "writer": story["writers"],
                "director": story["directors"],
                "rating": sum(part["rating"] for part in parts) / len(parts),
                "weight": sum(part["votes"] for part in parts) / len(parts),
            }
        )
    return result


def average(values, weights, method):
    if method == "mean":
        return sum(values) / len(values)
    if method == "weighted":
        return sum(weight * value for value, weight in zip(values, weights)) / sum(weights)
    if method == "median":
        ordered = sorted(values)
        middle = len(ordered) // 2
        return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2
    raise ValueError(f"unknown average: {method}")


def rank(stories, subject, method="weighted", k=5, era_adjusted=False):
    """The ranked subjects, best first, as dicts of id, stories (n), average (x̄) and score."""
    values = [story["rating"] for story in stories]
    weights = [story["weight"] for story in stories]
    if era_adjusted:
        eras = {}
        for story in stories:
            eras.setdefault(story["era"], ([], []))
            eras[story["era"]][0].append(story["rating"])
            eras[story["era"]][1].append(story["weight"])
        baseline = {era: average(*columns, method) for era, columns in eras.items()}
        values = [story["rating"] - baseline[story["era"]] for story in stories]
    overall = average(values, weights, method)

    members = {}  # subject id -> indices of its stories
    for index, story in enumerate(stories):
        for subject_id in story[subject]:
            members.setdefault(subject_id, []).append(index)

    ranking = []
    for subject_id, indices in members.items():
        n = len(indices)
        if n < MIN_STORIES[subject]:
            continue
        mean = average([values[i] for i in indices], [weights[i] for i in indices], method)
        ranking.append({"id": subject_id, "stories": n, "average": mean, "score": (k * overall + n * mean) / (k + n)})
    ranking.sort(key=lambda row: (-row["score"], row["id"]))
    return ranking
