# Times Table Forest

A times table practice app for children. Each fact is a tree on an 11 × 11 grid (2–12 × 2–12; 6 × 7 and 7 × 6 are the same tree, so 66 trees). A tree only grows when the fact is recalled correctly on the day it is due, so the forest shows retention rather than time played.

Static site, no build step. Open `index.html` directly or serve the folder:

```
python3 -m http.server 8000
```

## Deployment

GitHub Pages serves the root of `main` directly (Settings → Pages → Deploy from a branch). Every push to `main` goes live within a minute or two. `.nojekyll` stops GitHub running Jekyll over the files.

Live at https://si4star.github.io/tree-tables/

## Method

- **Retrieval practice.** Every question is answered from memory; the answer is never shown alongside the question.
- **Spaced repetition (Leitner).** Correct answers move a fact through: same round → 1 day → 3 days → 7 days → 21 days. A wrong answer resets it to a seed.
- **Strategy sequencing.** Tables unlock in the order 10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7. Harder facts are taught from easier ones (×9 = ×10 minus one lot; ×8 = double three times). The next table unlocks once every fact in the unlocked tables is planted and 80% have reached sprout.
- **Immediate error correction.** A wrong answer shows the correct answer and strategy; the child types it, and the fact returns 3 questions later.
- **Accuracy before speed.** No countdown. Answers slower than 6 seconds (the Multiplication Tables Check limit) still count, but the tree stays at sprout until it is answered quickly.

## Assumptions

- ×1 facts are excluded.
- Rounds are 20 questions (about 4 minutes). The first round is shorter because nothing is due for review yet.
- One profile per child. Progress is stored in the browser's `localStorage` on that device only; it does not sync.

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | Page shell and tree SVG symbols |
| `css/styles.css` | Styles, light and dark themes |
| `js/app.js` | Scheduling, round building, views and input handling |

## Not built yet

- Timed 25-question mock of the Multiplication Tables Check.
- Parent view showing the weakest facts.
