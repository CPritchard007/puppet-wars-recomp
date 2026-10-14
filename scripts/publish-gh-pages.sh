#!/usr/bin/env bash
# Publish only an already-built static site, preserving deployment history.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f web/dist/index.html || { echo 'Run bash scripts/build-web.sh first.' >&2; exit 1; }
repo_dir="$PWD"
source_sha="$(git rev-parse HEAD)"
deploy_dir="$(mktemp -d)"
trap 'git worktree remove --force "$deploy_dir" >/dev/null 2>&1 || rmdir "$deploy_dir" 2>/dev/null || true' EXIT
# ls-remote failures must not be mistaken for an absent branch.
remote_branch="$(git ls-remote --heads origin refs/heads/gh-pages)"
if [[ -n "$remote_branch" ]]; then
  git fetch origin refs/heads/gh-pages
  git worktree add --detach "$deploy_dir" FETCH_HEAD
else
  git worktree add --detach "$deploy_dir" HEAD
  git -C "$deploy_dir" switch --orphan "pages-publish-$(basename "$deploy_dir")"
fi
rsync -a --checksum --delete --exclude=.git "$repo_dir/web/dist/" "$deploy_dir/"
git -C "$deploy_dir" add --all
if ! git -C "$deploy_dir" diff --cached --quiet || ! git -C "$deploy_dir" rev-parse --verify HEAD >/dev/null 2>&1; then
  git -C "$deploy_dir" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m "Deploy web build from $source_sha"
fi
git -C "$deploy_dir" push origin HEAD:refs/heads/gh-pages
