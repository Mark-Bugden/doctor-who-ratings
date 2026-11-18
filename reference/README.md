# Reference tables

These are the hand-checked tables of stories and parts behind the demo's data. They come from Wikipedia's [List of Doctor Who episodes (1963–1989)](https://en.wikipedia.org/wiki/List_of_Doctor_Who_episodes_(1963%E2%80%931989)) and [List of Doctor Who episodes (2005–2025)](https://en.wikipedia.org/wiki/List_of_Doctor_Who_episodes_(2005%E2%80%932025)). The revisions used are in [`sources.json`](sources.json). Like their source, the tables are under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

| File | One row per | Columns |
| --- | --- | --- |
| [`stories.csv`](stories.csv) | story (291) | Wikipedia's story number, era, season, Doctor, title, writers, directors |
| [`parts.csv`](parts.csv) | part (863) | story, part number within the story, era, season, episode number within the season, title, air date, IMDb id |

People in the `writers` and `directors` columns are separated by `; `.

## How they're made

`python -m doctor_who_ratings.wikipedia` fetches both pages through the MediaWiki API and writes the two tables. `python -m doctor_who_ratings.match` then fills in each part's IMDb id. After that, the tables are checked by hand, and any corrections are made in the CSVs and committed. Rerunning the first command overwrites them only with `--force`, and the second only fills in missing ids.

## What's in them

- **Regular episodes only.** Whatever Wikipedia lists as a special is left out: specials tables, rows without a number in their season (the in-season Christmas specials), *The Five Doctors*, *Shada* (unbroadcast until 2018) and the 1996 TV film. That drops McGann, the War Doctor and Tennant's Fourteenth Doctor, so 13 Doctors remain.
- **A story is a story as Wikipedia numbers it.** Each classic serial is one story. A modern multi-parter is one story too: Wikipedia numbers "Aliens of London" and "World War Three" 160a and 160b, so they're story 160. Wikipedia numbers *The Trial of a Time Lord* (143a–d) and *Flux* (297a–f) the same way, so each of them is one story, with its title set by hand. A modern multi-parter without a title of its own is titled by its parts, as in "Aliens of London / World War Three".
- **The Doctor** is the section Wikipedia lists the story under. That puts *The Smugglers* and *The Tenth Planet* with Hartnell and *The Twin Dilemma* with Colin Baker, where the old season mapping got them wrong.
- **Credits** are the union of the credits for a story's parts, as Wikipedia gives them, for example both directors of *The Daleks*:
  - People Wikipedia marks as uncredited are kept, such as C. E. Webber on *An Unearthly Child*.
  - Story credits are kept, such as David Fisher on *City of Death*.
  - Where Wikipedia names the people behind a pseudonym, they're credited instead. "David Agnew", "Robin Bland", "Stephen Harris", "Norman Ashby" and "Guy Leopold" become the writers in brackets after them.
  - Where Wikipedia says a credit went to the wrong person, the person who did the work is credited (Malcolm Hulke, not David Whitaker, on part of *The Ambassadors of Death*).
  - *Attack of the Cybermen* stays credited to "Paula Moore", because Wikipedia doesn't name anyone behind the pseudonym.
- **Air dates** are the UK broadcast dates, in ISO format.

## The checks

`tests/test_reference.py` checks that:

- every season's part count matches Wikipedia's separate series overview table
- every part has a story, a Doctor, an air date and its own IMDb id
- the parts are in broadcast order
- each Doctor's run starts and ends with the right story.

## Matching to IMDb

IMDb files Doctor Who under three parents: `tt0056751` (1963–1989), `tt0436992` (2005 onwards) and `tt31433814` (2024 onwards, numbering its seasons from 1 again). Within each season, a part matches the IMDb episode with the same title, or with the story's title and the part's, as in "Spearhead from Space: Episode 1". Twenty parts whose titles IMDb writes differently ("Spyfall: Part One", "Flux: Chapter One - The Halloween Apocalypse") were matched by broadcast order within the season. All 863 matches pass two further checks: in every season, IMDb's episode numbers rise in broadcast order, and every IMDb year equals the part's air-date year.

IMDb's specials don't match anything. *The Five Doctors* and *The Snowmen* are the only ones IMDb files as numbered episodes within a season.

## Credits on IMDb

IMDb's writer credits (`title.crew`) aren't usable as writers. They agree with Wikipedia on only 22 of 291 stories:

- They credit the show's creators, Sydney Newman, Donald Wilson and C. E. Webber, on most classic stories.
- They credit creators of characters, such as Terry Nation for the Daleks, Kit Pedler and Gerry Davis for the Cybermen, and Robert Holmes for the Sontarans.
- They credit showrunners, such as Steven Moffat and Chris Chibnall.
- They include a few script editors, and on *The Hand of Fear*, Tom Baker and Elisabeth Sladen.

This is why the old analysis gave Terry Nation so many episodes. The directors agree on 269 of 291 stories. Most of the differences are spellings (Charles and Charlie Palmer, Ed and Edward Bazalgette); the rest are IMDb listing extra directors, such as Timothy Combe for a filmed sequence. The tables use Wikipedia's credits throughout. `python -m doctor_who_ratings.credits` prints the comparison.
