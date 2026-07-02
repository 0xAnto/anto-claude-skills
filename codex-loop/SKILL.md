---
name: codex-loop
description: Drive a GitHub PR through Codex review rounds until Codex replies "Didn't find any major issues". Posts "@codex review", waits for the 👀 ack (re-triggers if missed), polls for the review, fixes findings, replies to threads, pushes, repeats. Use when the user says "run codex on this PR", "codex loop", "iterate with codex until clean", or /codex-loop [PR#].
---

Drive the PR through Codex review rounds until it approves. Typically 2–8 rounds depending on PR size.

## Setup

1. Identify the PR: from the arguments if given, else `gh pr view --json number,headRefName,url`. No PR for the current branch: stop and tell the user.
2. `REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)` and `BOT="chatgpt-codex-connector"` (Codex's GitHub login).
3. Confirm the working tree is on the PR's head branch and clean. Uncommitted changes: stop and ask the user before touching them.

## The Loop (max 10 rounds)

### Step 1 — Trigger

```bash
TRIGGER_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMENT_ID=$(gh api "repos/$REPO/issues/$PR/comments" -f body="@codex review" --jq .id)
```

### Step 2 — Wait for 👀 acknowledgment

Codex reacts with 👀 in ~30s. Rarely it misses the comment — the 👀 check catches that. Run the poll as a **background Bash call** (`run_in_background: true` — foreground sleep is blocked); it exits the moment the reaction appears and you get re-invoked:

```bash
for i in $(seq 1 12); do
  EYES=$(gh api "repos/$REPO/issues/comments/$COMMENT_ID/reactions" \
    --jq '[.[] | select(.content=="eyes")] | length')
  [ "$EYES" -gt 0 ] && echo ACK && exit 0
  sleep 15
done
echo NO_ACK
```

- `ACK`: proceed to Step 3.
- `NO_ACK` after 3 minutes: Codex missed it. Post a fresh "@codex review" (new `COMMENT_ID`, new `TRIGGER_TIME`) and repeat Step 2. After 3 failed triggers, stop and tell the user Codex appears down.

### Step 3 — Poll for the review

The review lands 4–10 minutes after 👀. Poll in background Bash calls that each run ≤4.5 minutes (stays inside the prompt-cache window), sleeping 30s between checks and exiting early on arrival:

```bash
for i in $(seq 1 9); do
  N=$(gh api "repos/$REPO/pulls/$PR/reviews" \
    --jq '[.[] | select(.user.login=="'"$BOT"'") | select(.submitted_at > "'"$TRIGGER_TIME"'")] | length')
  [ "$N" -gt 0 ] && echo FOUND && exit 0
  sleep 30
done
echo NOT_YET
```

`NOT_YET`: immediately launch the next poll call. If 20 minutes pass in total with no review, re-trigger from Step 1 (counts as a failed trigger).

### Step 4 — Read the verdict

```bash
gh api "repos/$REPO/pulls/$PR/reviews" \
  --jq '[.[] | select(.user.login=="'"$BOT"'") | select(.submitted_at > "'"$TRIGGER_TIME"'")] | .[].body'
gh api "repos/$REPO/pulls/$PR/comments" \
  --jq '[.[] | select(.user.login=="'"$BOT"'") | select(.created_at > "'"$TRIGGER_TIME"'") | {id, path, line, body}]'
```

Also check issue comments after `TRIGGER_TIME` from `$BOT` — Codex sometimes replies there.

**If any new Codex text contains "Didn't find any major issues"** (match the phrase loosely): done. Go to Wrap Up.

### Step 5 — Fix, reply, push

Give the user a one-paragraph summary of the round's findings before fixing. Then for each finding:

- Read the actual code around the cited location first — verify the finding is real.
- Think like a senior engineer: when you find a good fix, check whether a better one exists; take the cleanest — but never overcomplicate for its own sake. Fixes are surgical: every changed line traces to a Codex comment. No gold-plating to impress the reviewer.
- **If more than one clean approach exists with a real tradeoff** — if you catch yourself thinking "two fixes are defensible" or "the simpler approach would be X, but…" — STOP and use AskUserQuestion: both options, one-line tradeoff each, your recommendation first. Never pick silently.
- Wrong finding: do NOT make a bogus change to appease it. Rebut it in the thread reply instead so Codex sees the rationale next round.

Run the project's format/lint/test commands if evident (e.g. `cargo fmt && cargo clippy && cargo test`). Commit the round's fixes as ONE commit (`fix: address codex review round N`), push normally — no force-push.

Reply to each Codex inline thread with what was done and the commit SHA (or the rebuttal):

```bash
gh api "repos/$REPO/pulls/$PR/comments/{comment_id}/replies" -f body="Fixed in <sha> — <one-line summary>"
```

Then resolve the threads you actually fixed (leave rebutted threads open so Codex re-examines them). Thread resolution is GraphQL-only — map each inline comment's `id` to its thread via `databaseId`:

```bash
gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){pullRequest(number:$pr){
    reviewThreads(first:100){nodes{id isResolved comments(first:1){nodes{databaseId}}}}}}}' \
  -f owner="${REPO%/*}" -f repo="${REPO#*/}" -F pr=$PR \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not) | {thread: .id, comment: .comments.nodes[0].databaseId}'

gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=$THREAD_ID
```

Return to Step 1.

## Wrap Up

Report: final verdict, rounds taken, per-round findings fixed and any rejected (with why), commits pushed (short SHAs), PR URL.
