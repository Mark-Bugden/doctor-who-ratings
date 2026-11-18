"""Fetch Wikipedia's lists of Doctor Who episodes and write the story and part tables in reference/.

Stories, air dates, writers and directors come from Wikipedia's "List of Doctor Who episodes
(1963–1989)" and "(2005–2025)", under CC BY-SA 4.0. The pages are fetched once through the
MediaWiki API, and the tables built from them are checked by hand and committed. The rest of the
pipeline reads the committed tables, so it doesn't depend on Wikipedia.

    uv run python -m doctor_who_ratings.wikipedia           # write the tables if they don't exist
    uv run python -m doctor_who_ratings.wikipedia --force   # overwrite them, losing any hand edits
"""

import argparse
import copy
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date

from bs4 import BeautifulSoup

from . import reference
from .paths import RAW, REFERENCE

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "doctor-who-ratings/0.1 (https://github.com/Mark-Bugden/doctor-who-ratings)"
PAGES = {
    "classic": "List of Doctor Who episodes (1963–1989)",
    "revived": "List of Doctor Who episodes (2005–2025)",
}

# Wikipedia numbers these as one story, with a letter for each segment, but gives no overall title.
STORY_TITLES = {"143": "The Trial of a Time Lord", "297": "Flux"}

# Credits that name two people in one phrase.
JOINT_CREDITS = {"Pip and Jane Baker": "Pip Baker and Jane Baker"}


def fetch(era, refresh=False):
    """The page's HTML and revision id, fetched once and kept in data/raw/wikipedia/."""
    path = RAW / "wikipedia" / f"{era}.json"
    if not path.exists() or refresh:
        query = urllib.parse.urlencode(
            {"action": "parse", "page": PAGES[era], "prop": "text|revid", "format": "json", "formatversion": 2}
        )
        request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request) as response:
            page = json.load(response)["parse"]
        page["fetched"] = date.today().isoformat()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(page, ensure_ascii=False), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


def _grid(table):
    """The table's rows, with every rowspan and colspan expanded so each row has one cell per column."""
    rows, spanning = [], {}  # spanning: column -> (cell, rows still to fill)
    for tr in table.find_all("tr"):
        if tr.find_parent("table") is not table:
            continue
        cells = iter(tr.find_all(["th", "td"], recursive=False))
        row = []
        while True:
            column = len(row)
            if column in spanning:
                cell, left = spanning.pop(column)
                if left > 1:
                    spanning[column] = (cell, left - 1)
                row.append(cell)
                continue
            cell = next(cells, None)
            if cell is None:
                break
            for _ in range(int(cell.get("colspan", 1))):
                if int(cell.get("rowspan", 1)) > 1:
                    spanning[len(row)] = (cell, int(cell["rowspan"]) - 1)
                row.append(cell)
        if row:
            rows.append(row)
    return rows


def _text(cell, line_break=", "):
    """A cell's text, without footnote markers. Line breaks separate people in the credits."""
    cell = copy.copy(cell)
    for tag in cell.select("sup, style, .reference"):
        tag.decompose()
    for br in cell.find_all("br"):
        br.replace_with(line_break)
    return re.sub(r"\s+", " ", cell.get_text()).strip()


def _title(text):
    return text.strip().strip('"').strip()


def people(credit):
    """The people in a writer or director credit, as Wikipedia gives it.

    Uncredited people and story credits are kept. A pseudonym is replaced by the people Wikipedia
    names in brackets after it, and a credit given to the wrong person by the person who did the work.
    """
    credit = re.sub(r"\s*\((uncredited|story)\)", "", credit)
    credit = re.sub(r"\s*\(credited to [^)]*\)", "", credit)
    pseudonym = re.fullmatch(r'"?[^"(,]+"?\s*,?\s*\((.+)\)', credit)
    if pseudonym:
        credit = pseudonym.group(1)
    for joint, separate in JOINT_CREDITS.items():
        credit = credit.replace(joint, separate)
    credit = re.sub(r"\s+(and|&)\s*,\s*", " and ", credit)  # "and" before a line break
    names = re.split(r",? from a story by |\s+and\s+|\s*&\s*|\s*,\s*", credit)
    return [name.strip(' "') for name in names if name.strip(' "')]


def parse(html, era):
    """Every row of the page's episode tables, specials included, in broadcast order."""
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for table in soup.select("table.wikiepisodetable"):
        section = table.find_previous("h4").get_text(" ", strip=True)
        doctor = table.find_previous("h3").get_text(" ", strip=True)
        season = re.match(r"(?:Season|Series) (\d+)", section)
        grid = _grid(table)
        header = [_text(cell, line_break=" ") for cell in grid[0]]

        def column(row, *names):
            for name in names:
                if name in header:
                    return _text(row[header.index(name)])
            return None

        for row in grid[1:]:
            if len({id(cell) for cell in row}) == 1:
                continue  # a label across the whole table, such as "Special"
            number = column(row, "No. in season", "No. in series")
            story = column(row, "No. story")
            part_title = _title(column(row, "Episode titles", "Title") or "")
            story_title = column(row, "Serial title")
            air_date = re.search(r"\d{4}-\d{2}-\d{2}", column(row, "Original release date") or "")
            rows.append(
                {
                    "era": era,
                    "doctor": doctor,
                    "section": section,
                    "season": int(season.group(1)) if season else None,
                    "special": season is None or number is None or not number.isdigit(),
                    "number": story,
                    "story": re.match(r"\d+", story).group(),
                    "story_title": _title(story_title) if story_title else None,
                    "title": part_title,
                    "air_date": air_date.group() if air_date else None,
                    "writers": people(column(row, "Written by")),
                    "directors": people(column(row, "Directed by")),
                }
            )
    return rows


def _story_title(story, titles):
    if story in STORY_TITLES:
        return STORY_TITLES[story]
    titles = list(dict.fromkeys(titles))
    stems = {re.sub(r",? Part \w+$", "", title) for title in titles}
    return stems.pop() if len(stems) == 1 else " / ".join(titles)


def build(rows):
    """The story and part tables, from the regular rows."""
    stories, parts = {}, []
    episodes = {}  # (era, season) -> parts so far
    for row in rows:
        if row["special"]:
            continue
        key = (row["era"], row["season"])
        episodes[key] = episodes.get(key, 0) + 1
        story = stories.setdefault(
            row["story"],
            {
                "story": row["story"],
                "era": row["era"],
                "season": row["season"],
                "doctor": reference.ACTORS[row["doctor"]],
                "titles": [],
                "writers": [],
                "directors": [],
                "parts": 0,
            },
        )
        if (story["era"], story["season"], story["doctor"]) != (row["era"], row["season"], reference.ACTORS[row["doctor"]]):
            raise ValueError(f"story {row['story']} spans seasons or Doctors")
        story["parts"] += 1
        story["titles"].append(row["story_title"] or row["title"])
        for column in ["writers", "directors"]:
            story[column].extend(name for name in row[column] if name not in story[column])
        title = row["title"] if row["title"] and row["title"] != "N/A" else row["story_title"]
        parts.append(
            {
                "story": row["story"],
                "part": story["parts"],
                "era": row["era"],
                "season": row["season"],
                "episode": episodes[key],
                "title": title,
                "air_date": row["air_date"],
            }
        )
    for story in stories.values():
        story["title"] = _story_title(story["story"], story.pop("titles"))
        del story["parts"]
    return list(stories.values()), parts


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="overwrite the tables in reference/")
    parser.add_argument("--refresh", action="store_true", help="fetch the pages again")
    args = parser.parse_args(argv)

    targets = [REFERENCE / "stories.csv", REFERENCE / "parts.csv"]
    if any(path.exists() for path in targets) and not args.force:
        sys.exit("reference/ already has the tables, which may have been edited by hand. Use --force to overwrite them.")

    rows, sources = [], {}
    for era in reference.ERAS:
        page = fetch(era, refresh=args.refresh)
        sources[era] = {"page": PAGES[era], "revid": page["revid"], "fetched": page["fetched"]}
        rows.extend(parse(page["text"], era))
    stories, parts = build(rows)
    reference.write("stories.csv", reference.STORY_COLUMNS, stories)
    reference.write("parts.csv", reference.PART_COLUMNS, parts)
    (REFERENCE / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{len(stories)} stories and {len(parts)} parts. Left out as specials:")
    for row in rows:
        if row["special"]:
            print(f"  {row['number']:>6}  {row['story_title'] or row['title']} ({row['air_date']}, {row['doctor']})")


if __name__ == "__main__":
    sys.exit(main())
