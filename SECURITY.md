# Security policy

Mustlist cards are read by AI coding agents, so harmful card content is a security issue, not just a content bug.

## What to report

- Card content that tries to steer an agent: hidden instructions, injected commands, links to executables, or text that asks for secrets.
- Wrong guidance that would make apps insecure (for example, advice that weakens authentication).
- Vulnerabilities in the website, build or validator.

## How to report

Please report privately. Do not open a public issue.

Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**.

Include the card id or URL, what is wrong, and why it is harmful. We aim to reply within 3 working days.

## What happens next

1. The commit that added the harmful content is reverted on `main`. Every channel (website, raw markdown and, later, the API and MCP server) is rebuilt from Git, so the content disappears everywhere on the next deploy.
2. We publish a short advisory.
3. We add a validator rule that would have caught it.

## Supported versions

Only the latest version on `main` is supported.
