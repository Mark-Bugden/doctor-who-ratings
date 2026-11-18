<!--
Draft write-up for the site, for Mark to edit. It replaces the body of
content/projects/doctor-who-ratings.md in the site repo (the old post), under the new title.

Suggested front matter:
  title: "Rating the Regenerations"
  summary: "Who is the best Doctor? IMDb ratings for every regular Doctor Who episode since 1963, and a leaderboard whose assumptions you can change."
  description: "IMDb ratings for every regular Doctor Who episode since 1963, on a timeline, in a heatmap and on a leaderboard of Doctors, writers and directors."

Every figure below comes from the 18 November 2026 snapshot. If the data is refreshed, check
them again: the ranks, the 126 settings, the vote medians (587 and 8,101) and the era averages.
-->

## Who is the best Doctor?

Doctor Who has been on television, on and off, since 1963, and every incarnation of the Doctor has fans who'll argue that theirs is the best. In 2025 I tried to settle the question with data instead of opinion, using IMDb's ratings for every episode. This is a rebuild of that project, and the demo above is the result.

The demo shows the rating of every regular episode on a timeline and in a season-by-episode heatmap, and ranks the Doctors, writers and directors on a leaderboard. A ranking like this rests on a few choices, such as which average to use, and the leaderboard lets you change them and watch the order move.

The short answer: David Tennant comes first however you count. What the choices change is everyone in between.

## The data

Ratings and vote counts come from IMDb's [non-commercial datasets](https://developer.imdb.com/non-commercial-datasets/), as of 18 November 2026. Information courtesy of IMDb (https://www.imdb.com). Used with permission.

Everything else comes from Wikipedia's lists of *Doctor Who* episodes, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): which episodes make up each story, when they aired, and who wrote and directed them.

That gives 863 episodes in 291 stories, from *An Unearthly Child* in 1963 to *The Reality War* in 2025. Only regular episodes are included. Specials, as Wikipedia lists them, are left out: the Christmas and New Year episodes, the anniversary specials and the 1996 TV film. That leaves out the Eighth, War and Fourteenth Doctors, so 13 Doctors remain.

### Stories, not episodes

The classic series told its stories as serials, most of them four or six episodes long, while the revived series mostly tells a story in one episode, sometimes two. Counting episodes would weight each classic Doctor by how long their serials were. So the unit here is the story, as Wikipedia numbers it. A story's rating is the mean of its episodes' ratings, and its weight is the mean number of votes per episode, so a six-part serial counts once, the same as a single episode.

## What changed from the first version

If you read the first version of this post, a few things are different.

- **Doctors are assigned by story.** The first version assigned each season to a Doctor. That credited *The Smugglers* and *The Tenth Planet* to Patrick Troughton instead of William Hartnell, and *The Twin Dilemma* to Peter Davison instead of Colin Baker.
- **The credits come from Wikipedia.** IMDb's writer credits include the show's creators on most classic stories, the creators of recurring characters (Terry Nation for the Daleks) and the showrunners. They agree with Wikipedia's on only 22 of the 291 stories.
- **The variance analysis is gone.** The first version said that directors explain about 40% of the variation in ratings. That doesn't hold up, for several reasons:
  - A filter meant to keep only people with at least three episodes never took effect.
  - Splitting each episode into writer–director pairs turned 863 episodes into about 2,660 rows.
  - The model fitted about 245 parameters to 863 episodes.
  - In the classic era, one director usually directed every part of a serial, so "director" mostly measured how alike a serial's parts were.

  I haven't tried to redo it.
- **The data came from IMDb's datasets.** The first version said the data was scraped and cleaned by hand. In fact it came from IMDb's official datasets, as it does now.
- **The latest episodes are complete.** The first version was written while the 2025 series was airing. This one runs to the end of it.

## How the leaderboard scores

Each Doctor, writer or director gets a score from the ratings of their stories. Three choices go into it, and each is a control in the demo.

**The average.** The plain mean of their story ratings, the mean weighted by each story's votes per episode, or the median.

**Shrinkage.** An average over a few stories moves more by chance than one over many. Christopher Eccleston has 10 stories, and Tom Baker has 41. Shrinkage pulls every average towards the average over all stories, m, as if everyone's record had k extra stories at m:

score = (k·m + n·x̄) / (k + n)

Here x̄ is someone's average over their n stories. At k = 5, two-thirds of Eccleston's score is his own average and one-third is the overall average, while 89% of Tom Baker's is his own. At k = 0 there's no shrinkage, and the slider goes up to 20. How much to shrink is a judgement call, which is why it's a slider.

**Era adjustment.** The two eras don't rate the same on IMDb: revived stories average 7.65, against 7.29 for classic ones (vote-weighted). With the adjustment on, each story is compared with the average story of its own era, and scores read as rating points above or below that average.

Writers and directors need at least three stories to be ranked, and a co-written story counts in full for each writer.

The defaults are the vote-weighted mean, k = 5 and no era adjustment. That's the method of the first version, applied to stories instead of episodes.

## What holds, and what moves

I ranked everyone under every combination of the controls: three averages, shrinkage from 0 to 20, and era adjustment on or off. That makes 126 combinations.

Some places never change. David Tennant is first in all 126, Peter Davison eighth and Jodie Whittaker thirteenth. Among the writers, Steven Moffat is first in all 126.

The middle moves:

- Tom Baker ranges from 2nd to 7th, Christopher Eccleston from 3rd to 7th, Peter Capaldi from 2nd to 6th, and Matt Smith from 2nd to 4th.
- At the defaults, turning on the era adjustment moves Tom Baker from 5th to 3rd and Jon Pertwee from 6th to 4th. Eccleston drops from 3rd to 5th, and Capaldi from 4th to 6th.
- The median with no shrinkage puts Capaldi second.
- Among the writers, Russell T Davies moves furthest, from 2nd to 24th of 37.
- The directors are the only list whose leader changes. Rachel Talalay is first in 97 of the 126 combinations, Graeme Harper in 26 and David Maloney in 3.

These describe how the ratings fall under each choice. They don't say why.

## Caveats

- The ratings are IMDb's, from whoever chose to rate each episode. Classic episodes have far fewer votes: a median of 587 per episode, against 8,101 for revived ones.
- The data is a snapshot from 18 November 2026. Ratings drift as votes come in, so the numbers will change a little over time.
- Specials are left out, so stories like *The Day of the Doctor* don't count towards anyone's score.

## The code

The code is on [GitHub](https://github.com/Mark-Bugden/doctor-who-ratings). A Python pipeline joins IMDb's datasets with Wikipedia's tables, checks the result and computes the leaderboard's rankings. The demo computes them again in JavaScript, and its tests check that the two agree exactly.
