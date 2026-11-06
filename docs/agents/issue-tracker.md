# Issue tracker: Local Markdown (never committed)

Issues and specs for this repo live as markdown files in `.scratch/` of the main
checkout:

    /Users/jole/Downloads/opbounty-stats/.scratch/

This repo is public (`jolejolevv-coder/letacios-fiesta`). `.scratch/` is listed
in `.gitignore` so tickets never reach GitHub. Never use GitHub Issues for this
repo, never commit or force-add anything from `.scratch/`, and never put player
data, credentials or decrypted ladder data into a ticket.

Worktrees (`opbounty-stats.wt/<name>`) do not contain `.scratch/` because it is
ignored. From a worktree always use the absolute path above.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file
- Blocking is recorded as a `Blocked by: NN, NN` line near the top
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `/Users/jole/Downloads/opbounty-stats/.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Approved specs

Approved feature specs still go to `specs/features/<feature>.md` (committed), as
before. `.scratch/` holds working tickets only.
