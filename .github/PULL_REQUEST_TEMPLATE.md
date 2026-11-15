## What this changes

<!-- One or two sentences. If this answers a request, add a line like: Request: #42 -->

## Kind of contribution

- [ ] Fix (typo, broken link, wording)
- [ ] Version entry
- [ ] Improvement (checklist item, option or verify check)
- [ ] New card
- [ ] Change of recommendation (link the discussion)
- [ ] Code (packages, website, CI)

## Checklist

- [ ] `pnpm validate` passes (and `pnpm validate --links` for changed cards)
- [ ] Every commit is signed off (`git commit -s`)
- [ ] I did not change `status: verified`, `reviewers`, `review_level` or `last_verified`
- [ ] `card_version` is bumped if card content changed

## For reviewers

- [ ] The summary answers the question in at most 300 characters and matches the recommended option.
- [ ] Every checklist item is specific and testable; the `must` items really are must-haves.
- [ ] The options are fair, and no option reads like an ad.
- [ ] Version entries link to the official docs first; Context7 is second; nothing is copied.
- [ ] Strong claims have sources.
- [ ] The verify checks would catch the most likely mistakes.
- [ ] No unsafe content: commands, hidden instructions, secrets or odd links.
- [ ] Seed-level cards: verify checks were run in a sample app (link):
- [ ] "Notes for reviewers" items are resolved.
