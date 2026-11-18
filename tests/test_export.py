"""Checks on the demo's data file, demo/public/data/episodes.json."""

import json

import pytest

from doctor_who_ratings import reference
from doctor_who_ratings.paths import EXPORT

MAX_BYTES = 300_000


@pytest.fixture(scope="module")
def data():
    return json.loads(EXPORT.read_text(encoding="utf-8"))


def test_size(data):
    assert EXPORT.stat().st_size < MAX_BYTES


def test_snapshot_date(data):
    assert len(data["snapshot"]) == 10 and data["snapshot"].startswith("20")


def test_it_carries_every_reference_part_in_order(data):
    parts = reference.parts()
    assert [(part["story"], part["season"], part["episode"]) for part in data["parts"]] == [
        (int(part["story"]), part["season"], part["episode"]) for part in parts
    ]


def test_ratings_are_between_1_and_10(data):
    for part in data["parts"]:
        assert part["rating"] is None or 1 <= part["rating"] <= 10, part
        assert part["votes"] is None or (isinstance(part["votes"], int) and part["votes"] > 0), part


def test_most_parts_are_rated(data):
    rated = sum(part["rating"] is not None for part in data["parts"])
    assert rated >= 0.99 * len(data["parts"])


def test_ids_resolve(data):
    doctors = {doctor["id"] for doctor in data["doctors"]}
    stories = {story["id"] for story in data["stories"]}
    for story in data["stories"]:
        assert story["doctor"] in doctors
        assert story["era"] in reference.ERAS
        for person in story["writers"] + story["directors"]:
            assert 0 <= person < len(data["people"])
    for part in data["parts"]:
        assert part["story"] in stories


def test_thirteen_doctors_in_order(data):
    assert [doctor["id"] for doctor in data["doctors"]] == [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15]
