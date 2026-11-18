"""The rankings reference: small cases worked by hand, and the fixtures the JS is tested against."""

import json

import pytest

from doctor_who_ratings import export, rankings
from doctor_who_ratings.paths import EXPORT, FIXTURES


def data(*stories):
    """Demo data from (id, era, doctor, writers, [(rating, votes), ...]) tuples."""
    return {
        "stories": [
            {"id": id, "era": era, "doctor": doctor, "writers": writers, "directors": []}
            for id, era, doctor, writers, _ in stories
        ],
        "parts": [
            {"story": id, "rating": rating, "votes": votes}
            for id, _, _, _, parts in stories
            for rating, votes in parts
        ],
    }


def test_a_story_is_the_mean_of_its_parts_and_counts_once():
    [story] = rankings.stories(data((1, "classic", 1, [], [(6, 100), (8, 300), (None, None)])))
    assert story["rating"] == 7
    assert story["weight"] == 200


def test_averages():
    assert rankings.average([1, 2, 6], [1, 1, 1], "mean") == 3
    assert rankings.average([1, 2, 6], [1, 0, 3], "weighted") == 19 / 4
    assert rankings.average([1, 2, 6], [1, 1, 1], "median") == 2
    assert rankings.average([1, 2, 6, 7], [1, 1, 1, 1], "median") == 4


def test_shrinkage_pulls_small_samples_towards_the_overall_average():
    stories = rankings.stories(
        data(
            (0, "classic", 1, [], [(9, 1)]),
            *[(i, "classic", 2, [], [(8.5, 1)]) for i in range(1, 5)],
            *[(i, "classic", 3, [], [(6, 1)]) for i in range(5, 10)],
        )
    )
    # Overall mean 7.3. Doctor 1: one story at 9. Doctor 2: four at 8.5. Doctor 3: five at 6.
    no_shrinkage = rankings.rank(stories, "doctor", "mean", k=0)
    assert [(row["id"], row["score"]) for row in no_shrinkage] == [(1, 9), (2, 8.5), (3, 6)]
    shrunk = rankings.rank(stories, "doctor", "mean", k=5)
    assert [row["id"] for row in shrunk] == [2, 1, 3]
    assert [row["score"] for row in shrunk] == pytest.approx([(5 * 7.3 + 4 * 8.5) / 9, (5 * 7.3 + 9) / 6, (5 * 7.3 + 30) / 10])


def test_era_adjustment_compares_each_story_with_its_era():
    stories = rankings.stories(
        data(
            (1, "classic", 1, [], [(6, 1)]),
            (2, "classic", 2, [], [(8, 1)]),
            (3, "revived", 3, [], [(8, 1)]),
            (4, "revived", 3, [], [(9, 1)]),
        )
    )
    # Era means: classic 7, revived 8.5. Adjusted: -1, +1, -0.5, +0.5.
    ranking = rankings.rank(stories, "doctor", "mean", k=0, era_adjusted=True)
    assert [(row["id"], row["score"]) for row in ranking] == [(2, 1), (3, 0), (1, -1)]


def test_writers_need_three_stories_and_co_writing_counts_in_full():
    writers = [[0, 1, 2], [0, 1, 2], [0, 1], [0]]
    stories = rankings.stories(data(*[(i, "classic", 1, w, [(7 + i, 1)]) for i, w in enumerate(writers)]))
    ranking = rankings.rank(stories, "writer", "mean", k=0)
    # Writer 0 wrote all four stories (mean 8.5), writer 1 three (mean 8), writer 2 only two.
    assert [(row["id"], row["stories"], row["score"]) for row in ranking] == [(0, 4, 8.5), (1, 3, 8)]


def test_the_fixtures_match_the_data_file():
    data = json.loads(EXPORT.read_text(encoding="utf-8"))
    committed = json.loads((FIXTURES / "rankings.json").read_text(encoding="utf-8"))
    assert committed == json.loads(export.dumps(export.fixtures(data)))


@pytest.mark.parametrize("subject", rankings.SUBJECTS)
def test_the_default_ranking_covers_every_eligible_subject(subject):
    data = json.loads(EXPORT.read_text(encoding="utf-8"))
    stories = rankings.stories(data)
    ranking = rankings.rank(stories, subject)
    counts = {}
    for story in stories:
        for subject_id in story[subject]:
            counts[subject_id] = counts.get(subject_id, 0) + 1
    assert {row["id"] for row in ranking} == {i for i, n in counts.items() if n >= rankings.MIN_STORIES[subject]}
