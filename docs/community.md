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

GitHub decides who may do what: only maintainers can close someone else's request, and nobody can approve their own proposal. Per-field review comments, the card editor (step C) and Accept (step D) still open GitHub.

Without sign-in, every write button opens the matching page on GitHub. "Submit request" and the card editor copy what you wrote first, so you can paste it there.

## Setup for maintainers

1. In the repository settings, turn on **Discussions** and add a category with the slug `requests` (an open-ended discussion format, so upvotes are on).
2. Create a fine-grained token for this repository with read-only access to contents, discussions, pull requests and commit statuses. Set it as `MUSTLIST_GITHUB_TOKEN` for the site (see [`apps/web/.env.example`](../apps/web/.env.example)).
3. Add a repository webhook to `https://<site>/library/api/github/webhook` with a secret, content type `application/json`, and these events: discussions, discussion comments, pull requests, pull request reviews, pull request review comments, check suites, check runs, statuses and pushes. Set the same secret as `MUSTLIST_WEBHOOK_SECRET`.

4. For sign-in, register a GitHub App (Settings → Developer settings → GitHub Apps):
   - Callback URLs: `https://<site>/library/api/auth/callback/github`, plus `http://localhost:3000/library/api/auth/callback/github` for local development.
   - Turn on "Expire user authorization tokens". Turn off the app's own webhook (the repository webhook above already refreshes the site).
   - Repository permissions: **Discussions: read and write** and **Pull requests: read and write**. Metadata stays read-only. No account permissions, so no email.
   - Install it on this repository only. A user's token can act only where the app is installed, and only as that user.
   - Set `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `BETTER_AUTH_SECRET` (see [`apps/web/.env.example`](../apps/web/.env.example)).

Sessions have no database. Better Auth keeps them in encrypted, HttpOnly cookies, and refreshes the 8-hour GitHub token with its 6-month refresh token. A session lasts 30 days.

The site caches what it reads. A webhook delivery marks it stale so the next visit reads GitHub again; without a webhook it refreshes every hour.
