# Branch Policy

This repository protects `main` as the default branch. Contributors should work
through pull requests so code, documentation, and protocol changes remain
reviewable.

## Required Pull Request Flow

- Create a branch from `main` for each issue or coherent change.
- Open a pull request and link related issues and ADRs.
- Require at least one approving review before merge. If the project is still
  operated solo, document any temporary exception in the pull request.
- Require all conversations to be resolved before merge.
- Keep branches up to date with the protected base before merging.
- Prefer squash or rebase merges that preserve a linear history.

## Required Status Checks

After the CI workflow from issue #2 is merged, configure branch protection to
require these status checks:

- `Lint (ubuntu-latest)`
- `Lint (macos-latest)`
- `Typecheck (ubuntu-latest)`
- `Typecheck (macos-latest)`
- `Test (ubuntu-latest)`
- `Test (macos-latest)`
- `Build (ubuntu-latest)`
- `Build (macos-latest)`
- `Security (ubuntu-latest)`
- `Security (macos-latest)`

These checks cover TypeScript, Rust, and Go linting, type checks, tests, builds,
and dependency/security scans.

## GitHub Branch Protection Settings

Configure `main` in GitHub under Settings -> Branches -> Branch protection
rules:

- Require a pull request before merging.
- Require at least one approving review when collaborators are available.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Require signed commits for cryptographic and release-sensitive work.
- Require linear history.
- Do not allow force pushes.
- Do not allow deletions.

Some settings require repository administrator permissions and cannot be fully
enforced by a pull request alone. This document records the intended policy so
the web UI configuration can be audited against version-controlled guidance.

## Ownership

`.github/CODEOWNERS` assigns the initial maintainer, `@Banyel3`, to all paths
and calls out package, app, docs, and GitHub workflow areas explicitly. Update
CODEOWNERS as collaborators, reviewers, or trustee operators join the project.

