# Final Submission Record

## Table of contents

| Section | What it covers |
|---|---|
| Repository record | URL, branch and commit values for the submission form |
| Git history summary | How the work was organised into branches |
| Steps only you can do | Everything that cannot be done from the build environment |
| Pre-submission checklist | Final checks from the assessment schedule |

## Repository record

| Field | Value |
|---|---|
| Repository name | `algions-ecommerce-platform` |
| Repository URL | **NOT YET CREATED.** Create it on GitHub, then run the commands below |
| Primary branch | `main` |
| Final commit ID | Run `git rev-parse HEAD` on `main` after your last commit and paste it here and in the form. Do not trust a value written in this file in advance |
| Git author | The local commits use a placeholder email (`REPLACE_WITH_YOUR_EMAIL@example.com`). See the next section |

## Git history summary

Work was done on feature branches and merged into `main` with merge commits, using conventional commit messages:

| Branch | Content |
|---|---|
| `feat/backend-foundation` | config, models, auth, profile and address book, tests |
| `feat/catalog` | search, filters, sorting, pagination, categories |
| `feat/cart-checkout-orders` | cart, idempotent checkout, simulated payments, inventory, cancellation |
| `feat/admin-api` | admin API, reports, reconciliation, audit trail, seed, OpenAPI docs |
| `feat/frontend-customer` | storefront and UI journey tests |
| `feat/frontend-admin` | admin console |
| `fix/payment-compensation-consistency` | bug found by a new test |
| `docs/final-documentation` | README and documents |

View it with `git log --oneline --graph --all`. No commit message claims anything that was not done; no commits were fabricated.

## Steps only you can do

```bash
# 1. Set your real identity BEFORE you push (the placeholder email is not a real address)
git config user.name  "Your Name"
git config user.email "your.university.email@example.edu"
# Existing commits keep the placeholder author. To rewrite them (optional, do it before pushing):
git rebase -r --root --exec 'git commit --amend --no-edit --reset-author'

# 2. Create an empty GitHub repository named algions-ecommerce-platform, then:
git remote add origin https://github.com/<you>/algions-ecommerce-platform.git
git push -u origin --all
```

Also: record the video, optionally deploy, fill in the submission form (including the AI and attribution field), and give reviewers access if the repository is private.

## Pre-submission checklist

- [ ] Fresh clone: follow the README quick start exactly on your machine and confirm the app and seed work
- [ ] `cd backend && npm test` passes on your machine
- [ ] Open the app in a real browser at phone, tablet and desktop widths and fix anything that looks wrong
- [ ] `git status` is clean; `git ls-files | grep -i "\.env$"` prints nothing
- [ ] Repository, report, video and Swagger/API doc links open in a private browser window
- [ ] You can explain checkout, idempotency and the stock update without reading the code
