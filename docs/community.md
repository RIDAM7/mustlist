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

Until sign-in is built, every write button on the site opens the matching page on GitHub: upvote or reply on the discussion, review on the pull request's files, merge on the pull request. "Submit request" and the card editor copy what you wrote first, so you can paste it there.

## Setup for maintainers

1. In the repository settings, turn on **Discussions** and add a category with the slug `requests` (an open-ended discussion format, so upvotes are on).
2. Create a fine-grained token with read access to this repository's contents, discussions, pull requests, commit statuses and checks. Set it as `MUSTLIST_GITHUB_TOKEN` for the site (see [`apps/web/.env.example`](../apps/web/.env.example)).
3. Add a repository webhook to `https://<site>/library/api/github/webhook` with a secret, content type `application/json`, and these events: discussions, discussion comments, pull requests, pull request reviews, pull request review comments, check suites, check runs, statuses and pushes. Set the same secret as `MUSTLIST_WEBHOOK_SECRET`.

The site caches what it reads. A webhook delivery marks it stale so the next visit reads GitHub again; without a webhook it refreshes every hour.
