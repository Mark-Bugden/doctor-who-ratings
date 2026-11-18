"""Checks on the hand-checked tables in reference/."""

from collections import Counter

import pytest

from doctor_who_ratings import reference

# Regular episodes per season, from the "Series overview" table on Wikipedia's lists of episodes
# (the revisions in reference/sources.json). The parts themselves come from the episode tables.
EPISODES_PER_SEASON = {
    "classic": [42, 39, 45, 43, 40, 44, 25, 25, 26, 26, 26, 20, 26, 26, 26, 26, 20, 28, 26, 22, 24, 13, 14, 14, 14, 14],
    "revived": [13, 13, 13, 13, 13, 13, 13, 12, 12, 12, 10, 10, 6, 8, 8],
}

# Each Doctor's first and last regular story. Assigning Doctors by season got the ones marked wrong.
RUNS = [
    ("William Hartnell", "An Unearthly Child", "The Tenth Planet"),
    ("Patrick Troughton", "The Power of the Daleks", "The War Games"),
    ("Jon Pertwee", "Spearhead from Space", "Planet of the Spiders"),
    ("Tom Baker", "Robot", "Logopolis"),
    ("Peter Davison", "Castrovalva", "The Caves of Androzani"),
    ("Colin Baker", "The Twin Dilemma", "The Trial of a Time Lord"),  # The Twin Dilemma
    ("Sylvester McCoy", "Time and the Rani", "Survival"),
    ("Christopher Eccleston", "Rose", "Bad Wolf / The Parting of the Ways"),
    ("David Tennant", "New Earth", "The Stolen Earth / Journey's End"),
    ("Matt Smith", "The Eleventh Hour", "The Name of the Doctor"),
    ("Peter Capaldi", "Deep Breath", "World Enough and Time / The Doctor Falls"),
    ("Jodie Whittaker", "The Woman Who Fell to Earth", "Flux"),
    ("Ncuti Gatwa", "Space Babies", "Wish World / The Reality War"),
]


@pytest.fixture(scope="module")
def stories():
    return reference.stories()


@pytest.fixture(scope="module")
def parts():
    return reference.parts()


def test_part_counts_per_season_match_wikipedia(parts):
    counts = Counter((part["era"], part["season"]) for part in parts)
    expected = {(era, season + 1): n for era, seasons in EPISODES_PER_SEASON.items() for season, n in enumerate(seasons)}
    assert counts == expected


def test_every_part_has_a_story_a_doctor_and_an_air_date(stories, parts):
    doctors = {story["story"]: story["doctor"] for story in stories}
    actors = {actor for _, _, actor in reference.DOCTORS}
    for part in parts:
        assert part["story"] in doctors, part
        assert doctors[part["story"]] in actors, part
        assert part["air_date"], part


def test_every_story_has_parts_and_credits(stories, parts):
    with_parts = {part["story"] for part in parts}
    for story in stories:
        assert story["story"] in with_parts, story
        assert story["writers"] and story["directors"], story


def test_every_part_has_its_own_imdb_id(parts):
    ids = [part["imdb_id"] for part in parts]
    assert all(ids)
    assert len(set(ids)) == len(ids)


def test_parts_are_numbered_in_broadcast_order(parts):
    for era in reference.ERAS:
        dates = [part["air_date"] for part in parts if part["era"] == era]
        assert dates == sorted(dates)
    seen = Counter()
    for part in parts:
        seen[(part["era"], part["season"])] += 1
        assert part["episode"] == seen[(part["era"], part["season"])], part


def test_each_doctor_has_one_run_from_the_right_first_to_last_story(stories):
    runs = []
    for story in stories:
        if not runs or runs[-1][0] != story["doctor"]:
            runs.append([story["doctor"], story["title"], story["title"]])
        runs[-1][2] = story["title"]
    assert [tuple(run) for run in runs] == RUNS


def test_the_stories_the_season_mapping_got_wrong(stories):
    doctor = {story["title"]: story["doctor"] for story in stories}
    assert doctor["The Smugglers"] == "William Hartnell"
    assert doctor["The Tenth Planet"] == "William Hartnell"
    assert doctor["The Twin Dilemma"] == "Colin Baker"
