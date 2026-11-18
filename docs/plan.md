# Plan: Rating the Regenerations

This is the agreed plan for rebuilding this project as an interactive demo for mark-bugden.github.io. It was settled with Mark on 2026-11-17, before any code was written. The site's requirements are in `site-contract-doctor-who-ratings.md`, which lives outside this repo, and in the [demo-kit README](https://github.com/Mark-Bugden/demo-kit#readme). This document covers what we're building on top of them.

## The goal

The demo lets a visitor explore IMDb ratings for every regular Doctor Who episode since 1963, and shows that "who is the best Doctor?" depends on how you count. A visitor:

1. opens on a timeline of every episode, with each Doctor's era banded
2. picks a Doctor and sees their run lit up in every view
3. finds any episode in a season-by-episode heatmap
4. ranks the Doctors, writers or directors, changes the assumptions behind the ranking, and watches the order move.

The project is descriptive. It makes no claims about what causes a rating.

## What changes from the old analysis

| Old notebook | New | Why |
| --- | --- | --- |
| Title "Directing the Doctor" | "Rating the Regenerations" | The old title rested on the directors finding, which is dropped. The slug stays `doctor-who-ratings`. |
| Weighted ANOVA: "directors explain ~40% of the variance" | Dropped, not redone | Several problems produce that number. The "at least 3 episodes" filter in cell 47 does nothing, because cell 48 rebuilds the lists from the unfiltered columns. Expanding writer × director pairs turns 863 episodes into about 2,660 rows, which inflates the F-tests. The model fits about 245 parameters to 863 episodes. In the classic era one director usually directed every part of a serial, so "director" mostly measures how alike a serial's parts are. And Type I ANOVA depends on the order of the terms. |
| Doctor assigned by season | Doctor assigned by story, checked by hand | The season mapping credits *The Smugglers* and *The Tenth Planet* to Troughton instead of Hartnell, and *The Twin Dilemma* to Davison instead of Colin Baker. |
| Unit: the episode, or the part of a classic serial | Unit: the story, as Wikipedia numbers it, in both eras | Counting parts weighted each classic Doctor by how many parts their serials had. Modern two-parters are also one story. |
| Writers from IMDb's `title.crew` | Writers and directors from Wikipedia, checked against IMDb | IMDb's list probably includes character-creator credits; the old table gives Terry Nation 90 episodes. Confirm in step 2. |
| Year only | Air dates from Wikipedia | IMDb's dumps give only the start year. |
| Fixed shrinkage, C = 5 | Shrinkage strength is a control | |
| The old post says the data was "scraped with a custom script and manually cleaned" | The write-up describes the official IMDb datasets and Wikipedia | The notebook used IMDb's official dumps. |

## Data

- **Ratings.** IMDb's non-commercial datasets: `title.episode`, `title.basics` and `title.ratings`, plus `title.crew` and `title.principals` for the credit cross-check. The parents are `tt0056751` (classic), `tt0436992` (revived) and `tt31433814`, IMDb's separate parent for the 2024 seasons onwards. IMDb has filed some of those episodes under more than one parent over time, so remove duplicates by title and air date, and check the counts against Wikipedia.
- **Stories, air dates and credits.** These come from Wikipedia's episode lists for 1963–1989 and 2005 onwards. A script fetches them once through the MediaWiki API and writes `reference/stories.csv`, which is checked by hand and committed. Credit Wikipedia (CC BY-SA 4.0) in the README and the write-up.
- **Scope.** Regular episodes only. A special is whatever Wikipedia lists as one. Leaving them out drops McGann (the 1996 TV film), the War Doctor and Tennant's Fourteenth Doctor, so 13 Doctors remain. The demo says so in "How this works".
- **Story ratings.** A story's rating is the mean of its parts' ratings. Its vote weight is the mean number of votes per part, so a six-part serial doesn't count six times. Parts without a rating are left out of the mean.
- **Eras.** Classic (1963–1989) and revived (2005 onwards). IMDb's separate parent for 2024 onwards is how IMDb files those episodes, not an era. Counted as its own era it would contain only Gatwa, and era adjustment would set his score to zero.
- **Snapshot.** Refresh before each release. The pipeline downloads the dumps into `data/raw/`, which is gitignored. The snapshot date goes into the data file, "How this works" and the write-up.
- **IMDb's terms.** The data is for "personal and non-commercial use" and "must not be altered/republished/resold/repurposed to create any kind of online/offline database of movie information". Mark accepts the grey area of publishing per-episode ratings (decided 2026-11-17), with these limits:
  - The bundle carries only the fields the views need.
  - The raw dumps are never committed.
  - IMDb's attribution, "Information courtesy of IMDb (https://www.imdb.com). Used with permission.", appears in "How this works", the README and the write-up.
- **Export.** One file, `demo/public/data/episodes.json`, under 300 KB, holding:
  - stories: id, title, Doctor, era, writers, directors
  - parts: story id, season, episode, title, air date, rating, votes
  - people, by id
  - the Doctors in order
  - the snapshot date

  If size matters, store the columns as arrays.
- **Checks (pytest).**
  - Part counts per season match Wikipedia.
  - Every part has a story, a Doctor and an air date.
  - No IMDb id appears twice.
  - Ratings are between 1 and 10.
  - The stories at each regeneration are credited to the right Doctor.

## The leaderboard

- **Subject.** Doctors, Writers or Directors.
- **Average.** The plain mean, the vote-weighted mean or the median of story ratings.
- **Shrinkage strength.** k runs from 0 to about 20 stories. A subject's score is (k·m + n·x̄) / (k + n), where x̄ is the subject's average over its n stories and m is the same average over all stories.
- **Era adjustment.** When on, each story's rating is replaced by its difference from its era's average, computed the same way. Scores then read as "+0.4 above its era".
- **Defaults.** Vote-weighted, k = 5, era adjustment off. This is the old post's method, now applied to stories. The status line names the leader under the current assumptions.
- **Small samples.** Writers and directors need at least 3 stories to be ranked, and a note says so. A co-written story counts in full for each writer.
- **Display.** A ranked dot plot with one row per subject. The default ranking is drawn faintly behind it, so the visitor sees what moved. Rows re-sort with a short transition, with none under `prefers-reduced-motion`.
- **Reference.** `src/doctor_who_ratings/rankings.py` computes the same rankings. The export writes fixtures from it, and node:test checks that the JS matches.

## The experience

| | |
| --- | --- |
| Views | Timeline (opening), Heatmap and Leaderboard, switched with a View `select()` in the controls rail. |
| Timeline | One dot per episode or part at its air date, sized by votes. Each story's mean is a short bar across its parts. The Doctors' eras are alternating bands, labelled directly, and the 1989–2005 gap shows. Hover or tap for title, story, Doctor, rating, votes, writer and director. |
| Heatmap | Season × episode, one era at a time. Uses the slate-to-amber scale. Cells keep a minimum size, and the grid scrolls sideways within the stage on narrow screens. |
| Doctor selector | With no Doctor selected, every episode is drawn in the muted text colour. Selecting a Doctor lights their run in the accent and drops everything else to the curve colour. On the heatmap, the other Doctors' cells dim instead (see "Look"). |
| Title search | Finds an episode or story and jumps to it in the current view. This is also the keyboard path into the charts. |
| Era toggle | Classic / revived, for the heatmap. |
| Rating / votes | Recolours the heatmap and rescales the timeline by votes (log scale). Disabled on the leaderboard. |
| Status line | What's highlighted or found; on the leaderboard, the current leader. |
| How this works | Sources and snapshot date, IMDb's attribution, what a "story" is, why specials are left out, and what each assumption does. |
| Copy | Plain, with no claims about why ratings differ. |

## Look

- **Kit.** The demo builds on demo-kit v0.2.0, whose tokens follow the site's design. The site contract's examples still show v0.1.0. The demo is dark whatever the OS prefers, standalone too, and light only under `<html data-theme="light">`.
- **Colours.** The views use the kit's tokens directly. Charts are drawn on the stage's `--color-surface`, as the kit's README asks. The contrast on that surface:

  | Token | Use | Dark | Light |
  | --- | --- | --- | --- |
  | `--color-muted` | every episode, while no Doctor is selected | 7.3:1 | 6.4:1 |
  | `--color-accent` | the selected or hovered Doctor | 10.6:1 | 5.4:1 |
  | `--color-curve` | the other Doctors while one is selected; era bands and reference lines | 2.9:1 | 2.5:1 |

  `--color-curve` is below 3:1, so it only marks context, never anything that must be seen on its own.
- **Doctors.** There's no colour per Doctor, and the kit's categorical slots aren't used.
- **Heatmap scale.** A sequential scale. In dark mode it runs from dim slate for low ratings to `--color-sodium` for high, and in light mode from pale to `--color-halpha`.
  - The two ends are the demo's only local colours. As the kit's changelog asks, the dark values go on `[data-demo]` and the light ones under `:root[data-theme="light"] [data-demo]`, with no `prefers-color-scheme`.
  - Both ends must clear 3:1 on the surface. `--color-curve` doesn't, so the dark low end sits a little lighter than it.
  - The light scale needs more thought (see "Open questions").
- **Highlighting the heatmap.** The scale's high end is the accent colour in both themes, so the Doctor highlight can't recolour cells there. Instead it dims the other Doctors' cells, and a search hit gets an outline in `--color-text`.
- **Stills.** Render them from the built demo's opening timeline, which is dark under v0.2.0. Don't reuse the stub's stills or the contract's image script, which both use the old paper colour.

## Repo layout (target)

```
demo/                        the site bundle, built with demo-kit (see the site contract)
  src/main.js                frame, controls, view switching and shared state
  src/views/                 timeline, heatmap, leaderboard
  src/rankings.js            the leaderboard maths: pure functions
  public/data/episodes.json  written by the export, and committed
  test/                      node:test, including the fixtures from the Python reference
src/doctor_who_ratings/      Python: fetch, join, checks, rankings reference, export
reference/stories.csv        the hand-checked story table from Wikipedia
tests/                       pytest
legacy/                      the original notebook (outputs stripped), utils.py and requirements.txt
docs/                        this plan and the draft write-up
pyproject.toml, uv.lock      a uv project
LICENSE                      MIT
```

- **CI.** The site contract's `demo.yml` stays exactly as specified. The tests (pytest, node:test, and the check of JS against Python) go in a separate workflow.

## Milestones

### 0. Rewrite history
- [ ] Use `git filter-repo` in a scratch clone to remove `.venv/` from every commit. It was added in the initial commit (2025-03-24) and removed in the next. It is 89.4 MiB of the 93.5 MiB pack, and about 4 MiB remains, mostly past versions of the notebook.
- [ ] Mark reviews the result.
- [ ] With Mark's explicit go-ahead: force-push `main` and the `v0.1.0` tag (the stub release and its zip keep working), and delete the merged `demo-stub` branch. GitHub keeps PR #1's commits, so the old blobs stay on its servers, but fresh clones shrink.

### 1. Clean up the repo (PR)
- [ ] Move the notebook, `utils.py` and `requirements.txt` to `legacy/`, with the notebook's outputs stripped. Add a note saying why its variance analysis doesn't hold.
- [ ] Add the MIT `LICENSE`, the brief's `.gitignore`, the uv project and an `nbstripout` hook.
- [ ] Move the demo to demo-kit v0.2.0. Change the kit tag in `demo/package.json` and `kitVersion` in the manifest together, and run `npm install` to update the lockfile. Set `index.html`'s `color-scheme` meta to `dark`, as in the template. The stub's paper-coloured stills stay until step 3 replaces them.
- [ ] Rewrite `README.md`: what, why, one figure, how to run it in three commands, links to the write-up and demo, and the IMDb and Wikipedia credits. Leave `Assets/banner.png` in place until Mark decides about it (see "Open questions").
- [ ] Commit this plan.

### 2. Data pipeline (PR)
- [ ] Fetch the IMDb dumps and the Wikipedia tables. Build `reference/stories.csv` and check it by hand, especially at the regenerations, the modern two-parters and the 2024 seasons onwards.
- [ ] Confirm whether IMDb's writer list includes creator credits, and reconcile the credits with Wikipedia.
- [ ] Join and check the data (pytest), and export `episodes.json`. Add the Python rankings reference and its fixtures.

### 3. Timeline and heatmap: release this repo's `v0.2.0`, status `in-progress`
- [ ] The frame, the View select, the Doctor selector, title search, the era toggle and the rating / votes switch.
- [ ] The timeline and heatmap views: hover and tap, linked highlights, and sideways scrolling on narrow screens. Set the heatmap scale's local colours, and check their contrast on the surface in both themes.
- [ ] Rewrite the manifest: title, tagline, summary, tags, and `about`, with the attribution and snapshot date. Update `built`.
- [ ] Render the stills from the opening state.
- [ ] Tell Mark the tag and the new title, so he can update the site.

### 4. Leaderboard and write-up: release `v1.0.0`, status `live`
- [ ] The leaderboard view: the subject switch, the three assumption controls, the faint default ranking and the status line. Test the JS against the Python fixtures.
- [ ] Draft the write-up in `docs/writeup.md`, in the site's voice, for Mark to edit and move to the site.
- [ ] Refresh the data snapshot, rebuild, and update `built`.
- [ ] Mark bumps the tag in the site's `data/projects.yaml` and takes the write-up out of draft.

## For Mark, on the site

- **The title.** Change it to "Rating the Regenerations" in `content/projects/doctor-who-ratings.md` and in the portfolio brief. The slug, and so the URL, stay the same.
- **The write-up.** The site page's body is still the old post, which mentions the variance "deep-dive". The draft from step 4 replaces it.

## Open questions

- **Banner and Tennant photo.** Mark checks whether he may use them: the banner imitates the show's logo, and the photo looks like a BBC promotional still.
- **The heatmap's light scale.** A pale low end disappears on the white surface. A scale from a 3:1 grey up to H-alpha red keeps both ends visible, but leaves little difference in lightness between them. Choose the light endpoints with a contrast and colour-vision check when building the heatmap.
- **Season labels from 2024 onwards.** The BBC calls them Season 1 and Season 2, while Wikipedia numbers them Series 14 and 15. Choose the heatmap's labels when building it.
- **New episodes.** Whatever regular episodes are on IMDb at snapshot time are included. Check that the seasons from 2024 onwards are complete and not duplicated across IMDb's parents.
