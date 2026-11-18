# Legacy analysis

The project's original analysis from March–August 2025, which became the "Directing the Doctor" blog post. It is kept for reference. Its outputs have been stripped, and it is no longer maintained.

| File | What it is |
| --- | --- |
| `doctor-who-imdb-analysis.ipynb` | The notebook. It downloads IMDb's datasets, assigns each episode a Doctor, ranks the Doctors, writers and directors by vote-weighted and shrinkage averages, and fits a weighted linear model with an ANOVA. |
| `utils.py` | The season-to-Doctor and Doctor-to-actor mappings the notebook imports, and a helper it doesn't use. |
| `requirements.txt` | The notebook's pinned dependencies (Python 3.12). |

Run from this folder, the notebook imports `utils.py` and downloads IMDb's current datasets into `data/raw/` here. Its numbers will therefore differ from the old post's.

## What doesn't hold

The post's headline, that directors explain about 40% of the variance in ratings, is not supported. Several problems produce that number:

- **The filter does nothing.** The cell that keeps only writers and directors with at least 3 episodes builds `model_df_filtered`, but the next cell rebuilds the lists from the unfiltered columns, and the model never uses the filtered table.
- **Rows are inflated.** Each episode is expanded into one row per writer × director pair, which turns 863 episodes into 2,660 rows. The weights sum to one per episode, but the F-tests count rows, so they look far more certain than they are.
- **The model is overfitted.** It fits 245 parameters (the intercept, plus 12 for the Doctors, 114 for the writers and 118 for the directors) to 863 episodes.
- **"Director" mostly measures the serial.** In the classic era, one director usually directed every part of a serial, so the director term mostly captures how alike a serial's parts are.
- **The split depends on the order.** A Type I ANOVA assigns shared variance to whichever term comes first, so reordering the formula changes the percentages.

Two more problems affect the rest of the notebook:

- **Some stories are credited to the wrong Doctor.** Doctors are assigned by season, which credits *The Smugglers* and *The Tenth Planet* to Troughton instead of Hartnell, and *The Twin Dilemma* to Davison instead of Colin Baker.
- **Classic Doctors are weighted by their serials' length.** Each part of a classic serial counts as an episode, so a six-part serial counts six times.

The rebuild drops the variance analysis and fixes both. [`docs/plan.md`](../docs/plan.md) has the details.
