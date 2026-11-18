# Requests and proposals

The site's community pages show what happens on GitHub, in Mustlist's own words. GitHub stores everything; there is no database.

| On the site   | On GitHub                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Request       | A discussion in the **Requests** category                                                          |
| Need this too | An upvote on that discussion                                                                       |
| Discussion    | The discussion's comments and replies                                                              |
| Proposal      | A pull request that changes one file under `cards/`                                                |
| Checks        | The pull request's checks (CI)                                                                     |
| Review        | A pull request review: approve, request changes or comment                                         |
| Accept        | Merging the pull request                                                                           |
| Maintainers   | [`MAINTAINERS`](../MAINTAINERS)                                                                    |
| Reviewers     | Topic owners in [`.github/CODEOWNERS`](../.github/CODEOWNERS), for example `cards/auth/** @handle` |

## How a request is read

The request form ([`.github/DISCUSSION_TEMPLATE/requests.yml`](../.github/DISCUSSION_TEMPLATE/requests.yml)) asks for the topic, the stack and what you are building. A request is:

- **Open** until a pull request links it, then **In progress**.
- **Resolved** when the discussion is closed as resolved, or a linked pull request is merged.
- **Closed** when the discussion is closed as a duplicate or outdated.

## How a proposal is read

- The pull request must change a card file, `cards/<topic>/<stack>.md`. Other pull requests are not proposals.
- **Type**: a `new-card`, `change`, `version-update` or `re-check` label wins. Otherwise a new file is a new card, a title starting with "Re-check" is a re-check, a title starting with "Version update" (or a change to version notes only) is a version update, and anything else is a change.
- **Status**: draft pull request → Draft; changes requested → Changes requested; approved → Approved; merged → Accepted; closed → Closed; otherwise In review.
- **Linked request**: write `Request: #42` (or paste the discussion link) under "What this changes" in the pull request.
- **Changes** compares the card at the pull request's base and head, field by field. **Preview** shows the card at the head.

## Writing

With "Sign in with GitHub" set up, signed-in people write from the site, and it posts to GitHub as them:

| On the site                                  | On GitHub                                                    |
| -------------------------------------------- | ------------------------------------------------------------ |
| Reply, reply to a comment                    | A discussion comment or reply                                |
| Need this too                                | Add or remove an upvote                                      |
| Submit request                               | A new discussion in Requests, in the request form's format   |
| Mark resolved, close, close as duplicate     | Close the discussion (resolved, outdated, duplicate); reopen |
| Approve, request changes, comment (proposal) | A pull request review                                        |
| Comment on a field (Changes tab)             | A review comment on that field's lines in the card file      |
| Submit for review (editor)                   | A pull request with the card, opened for you (see below)     |
| Accept (maintainers)                         | Approve, promote on the branch, `accepted` label, auto-merge |

GitHub decides who may do what: only maintainers can close someone else's request, and nobody can approve their own proposal.

**Proposals from the editor.** GitHub only lets people open a pull request from a branch they can write to, so the Mustlist Library app does it for them: it commits the card to `proposals/<login>/<topic>-<stack>` with the person as the commit's author and sign-off (their GitHub noreply address), and opens the pull request with a hidden `mustlist-proposer` marker. The site, the checks and the approval count all treat that person as the proposer. Submitting again adds a revision to the same pull request. Because the app opens these pull requests, the site limits each person to 3 open proposals from the editor at a time (`MAX_OPEN_SITE_PROPOSALS` in `apps/web/lib/community/limits.ts`); revisions don't count, and pull requests opened with git aren't limited. The editor keeps a change's status, reviewers and dates as they are and bumps `card_version` (minor), since maintainers set those when they accept.

**Accept.** For a maintainer, the proposal page's Accept box approves the proposal (if they haven't yet), runs the same promotion as `pnpm promote` on the proposal's branch with the approvers as reviewers, adds the `accepted` label and turns on auto-merge (squash). The card guard check allows the promotion because a maintainer added the label; any later push by someone else removes the label. Seed level needs one maintainer; community level needs two approvals, one from a maintainer. Proposals from forks, or that change more than one file, are accepted on GitHub: run `pnpm promote` on the branch, add the `accepted` label, then merge.

Without sign-in, every write button opens the matching page on GitHub. "Submit request" and the card editor copy what you wrote first, so you can paste it there.

## Setup for maintainers

1. In the repository settings, turn on **Discussions** and add a category with the slug `requests` (an open-ended discussion format, so upvotes are on).
2. Create a fine-grained token for this repository with read-only access to contents, discussions, pull requests and commit statuses. Set it as `MUSTLIST_GITHUB_TOKEN` for the site (see [`apps/web/.env.example`](../apps/web/.env.example)).
3. Add a repository webhook to `https://<site>/library/api/github/webhook` with a secret, content type `application/json`, and these events: discussions, discussion comments, pull requests, pull request reviews, pull request review comments, check suites, check runs, statuses and pushes. Set the same secret as `MUSTLIST_WEBHOOK_SECRET`.

4. For sign-in, register a GitHub App (Settings → Developer settings → GitHub Apps):
   - Callback URLs: `https://<site>/library/api/auth/callback/github`, plus `http://localhost:3000/library/api/auth/callback/github` for local development.
   - Turn on "Expire user authorization tokens". Turn off the app's own webhook (the repository webhook above already refreshes the site).
   - Repository permissions: **Contents: read and write**, **Discussions: read and write** and **Pull requests: read and write**. Metadata stays read-only. No account permissions, so no email. (Contents lets the app commit proposals from the editor, and lets maintainers accept and merge from the site.)
   - Install it on this repository only. A user's token can act only where the app is installed, and only as that user.
   - Set `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `BETTER_AUTH_SECRET` (see [`apps/web/.env.example`](../apps/web/.env.example)).
   - For proposals from the editor and closing requests on merge: generate a private key in the app's settings and set it as `GITHUB_APP_PRIVATE_KEY` (the whole PEM; writing `\n` for each line break also works), plus the app's numeric `GITHUB_APP_ID`. Without them the editor copies the card and opens GitHub's editor instead.

5. Keep the pull-request checks allowed. From 2 December 2026 GitHub blocks workflows triggered by `pull_request_target` in public repositories that have no Actions event policy, and the required **Sign-off** and **Card guard** checks use that trigger (`.github/workflows/pr.yml`). The repository has one policy (Settings → Actions → Policies, or the REST API `repos/{owner}/{repo}/actions/policies`): enforcement active, workflow path `.github/workflows/pr.yml` only, allowed events `pull_request_target`. It covers no other workflow, so CI, the bots and Dependabot are unaffected. If you rename `pr.yml`, update the policy's workflow path.

## Settings this repository uses

- **Ruleset "Protect main"** (Settings → Rules): pull requests need **Typecheck, lint, test, validate, build**, **Sign-off** and **Card guard** to pass; squash merges only; no force pushes or deletion. Repository admins can bypass it, so maintainers can still push small fixes directly.
- **General**: auto-merge on (Accept uses it), branches deleted after merge, sign-off required for commits made in GitHub's web editor.
- **npm**: the `mustlist` package trusts `.github/workflows/release.yml` (trusted publishing). Bump `packages/cli/package.json`'s version on main and the workflow publishes it with provenance; no npm token exists anywhere.

Sessions have no database. Better Auth keeps them in encrypted, HttpOnly cookies, and refreshes the 8-hour GitHub token with its 6-month refresh token. A session lasts 30 days.

The site caches what it reads. A webhook delivery marks it stale: the next visit still gets the cached page at once and starts a GitHub read in the background, so the visit after it shows the change. Without a webhook it refreshes every hour. Changes made on the site itself (a reply, a vote, a proposal) show up straight away for the person who made them.
