"""Download IMDb's non-commercial datasets and extract the Doctor Who rows.

The datasets (https://developer.imdb.com/non-commercial-datasets/) are for personal and
non-commercial use. The dumps go into data/raw/ and the extracted rows into data/interim/;
neither is ever committed.

    uv run python -m doctor_who_ratings.imdb            # download what's missing, then extract
    uv run python -m doctor_who_ratings.imdb --refresh  # download everything again first
"""

import argparse
import gzip
import json
import shutil
import sys
import urllib.request
from email.utils import parsedate_to_datetime

from .paths import INTERIM, RAW

BASE_URL = "https://datasets.imdbws.com/"
DATASETS = ["title.episode", "title.basics", "title.ratings", "title.crew", "title.principals", "name.basics"]

# IMDb files Doctor Who under three parents. The third holds the seasons from 2024 onwards;
# it is how IMDb files them, not an era.
PARENTS = {"tt0056751": "classic", "tt0436992": "revived", "tt31433814": "revived"}


def raw_path(name):
    return RAW / f"{name}.tsv.gz"


def interim_path(name):
    return INTERIM / f"{name}.tsv"


def download(name, refresh=False):
    """Download one dump unless it's already there, and record its Last-Modified date."""
    path = raw_path(name)
    snapshot = read_snapshot()
    if path.exists() and name in snapshot and not refresh:
        return
    RAW.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {name}...", flush=True)
    partial = path.with_suffix(".part")
    with urllib.request.urlopen(BASE_URL + path.name) as response, open(partial, "wb") as out:
        modified = parsedate_to_datetime(response.headers["Last-Modified"]).date().isoformat()
        shutil.copyfileobj(response, out, length=1 << 20)
    partial.replace(path)
    snapshot[name] = modified
    (RAW / "snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")


def read_snapshot():
    """The Last-Modified date of each downloaded dump."""
    path = RAW / "snapshot.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def snapshot_date():
    """The date of the ratings: the snapshot the demo shows."""
    return read_snapshot()["title.ratings"]


def _filter(name, column, wanted):
    """Yield the header, then the rows of a dump whose `column` is in `wanted`."""
    with gzip.open(raw_path(name), "rt", encoding="utf-8", newline="\n") as lines:
        header = next(lines).rstrip("\n").split("\t")
        yield header
        index = header.index(column)
        for line in lines:
            if index == 0:
                key = line[: line.find("\t")]
                if key not in wanted:
                    continue
            fields = line.rstrip("\n").split("\t")
            if fields[index] in wanted:
                yield fields


def _write(name, rows):
    # The dumps are plain tab-separated text with no quoting, so the rows are written the same way.
    INTERIM.mkdir(parents=True, exist_ok=True)
    with open(interim_path(name), "w", encoding="utf-8", newline="\n") as out:
        count = -1
        for row in rows:
            out.write("\t".join(row) + "\n")
            count += 1
    print(f"  {name}: {count} rows", flush=True)


def read(name):
    """The extracted rows of one dump, as dicts. IMDb writes missing values as \\N."""
    with open(interim_path(name), encoding="utf-8", newline="\n") as file:
        header = next(file).rstrip("\n").split("\t")
        rows = (line.rstrip("\n").split("\t") for line in file)
        return [{key: (None if value == "\\N" else value) for key, value in zip(header, row)} for row in rows]


def extract():
    """Keep the rows for Doctor Who's episodes, and the people credited on them."""
    print("Extracting the Doctor Who rows...", flush=True)
    _write("title.episode", _filter("title.episode", "parentTconst", set(PARENTS)))
    titles = set(PARENTS) | {row["tconst"] for row in read("title.episode")}
    for name in ["title.basics", "title.ratings", "title.crew", "title.principals"]:
        _write(name, _filter(name, "tconst", titles))

    people = set()
    for row in read("title.crew"):
        for column in ["directors", "writers"]:
            people.update((row[column] or "").split(","))
    people.update(row["nconst"] for row in read("title.principals"))
    people.discard("")
    _write("name.basics", _filter("name.basics", "nconst", people))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--refresh", action="store_true", help="download every dump again")
    args = parser.parse_args(argv)
    for name in DATASETS:
        download(name, refresh=args.refresh)
    extract()
    print(f"Snapshot: {snapshot_date()}")


if __name__ == "__main__":
    sys.exit(main())
