---
name: goal
description: Run the execution loop on a goal spec for web — plan,
  implement in an ephemeral worktree, verify with hk verify until green.
  Use when the user says /goal <issue or task>, "run the loop on ...",
  or "loop this goal".
---

# /goal — execution loop for web

Drive a Writer/Verifier loop per ADR 0009 (hk repo): mutate only an
ephemeral worktree on a throwaway branch. **Never merge, never push,
never touch the trunk.** All state lives in a ledger outside the repo.

## Preconditions

- web uses the umbrella layout (`.bare` + `main/` trunk). Classic
  checkout → run `hk migrate web` first.
- A goal spec authored to the template (hk repo:
  `docs/specs/2026-07-28-goal-spec-template-design.md`) and
  human-reviewed — normally the body of a GitHub goal issue. No spec →
  hold a scouting session and author one; never launch from a bare
  prompt.

## Setup (once per goal)

1. **Ledger**: create `loop_state.md` at the web umbrella root
   (the directory holding `.bare`) — it sits outside every worktree, so
   the repo never sees it. If a live loop already owns that file, use
   `loop_state_<slug>.md` and add a pointer line in the main ledger.
   Paste the spec verbatim; set `Phase: planning`, `Iteration: 0 / 5`.
2. **Base**: `git -C <umbrella root> fetch origin`, then pin the
   `origin/main` SHA into the ledger. Never cut from the local trunk —
   it can be stale.
3. **Worktree**: `git -C <umbrella root> worktree add loop-<slug> -b
   loop/<slug> <SHA>` — a sibling of `main/`. Bootstrap it (dependency
   install, project generation) so the gate can run.
4. **Plan** the goal into verifiable slices (each = code + test + green
   gate) as checkboxes in the ledger. Set `Phase: executing`.

Ledger sections: Goal · Status · Base & worktree · Plan · Scouted
facts · Design pins · Test intent · Hard constraints · Verification
command · Verification log · Latest failure (signature + stack,
verbatim) · Current blockers · Learnings candidates · Writer report /
Verifier verdict per iteration.

## Iteration (repeat until an exit condition fires)

1. **Writer** — fresh subagent. Its prompt is built ONLY from the
   ledger: goal, plan, current slice, latest failure signature + error
   stack — nothing else, so context never compounds across iterations.
   It implements one slice test-first inside the loop worktree. Process
   rules: absolute paths in every command; long builds run in the
   FOREGROUND with a generous explicit timeout, never as background
   tasks.
2. **Verifier** — fresh subagent, blind to the Writer's reasoning. It
   runs `hk verify web --worktree loop-<slug> --json` (targeted
   reruns are allowed while iterating; finishing requires one full
   unscoped run), audits every scrutiny note the Writer flagged, and
   applies the adversarial checklist to `git diff <base SHA>...HEAD`:
   forbidden constructs, swallowed errors, shared-state races in
   parallel tests, boundary cases (empty, nil/zero/negative,
   first/last, offline/error paths), stale doc comments on changed
   contracts. It writes the verdict into the ledger. If subagents die
   on infrastructure, 0 verdicts read as INCONCLUSIVE — never as pass
   or fail.
3. **Record** — bump the iteration counter, append a verification-log
   row keyed on `failureSignature` from the verdict, update blockers
   and learnings candidates.

## Exit conditions

- **All green** (`"ok": true` on a full run) → `Phase: done`. Summarize
  the diff; report the worktree path, the branch and the goal issue to
  comment on. Leave the branch for human review.
- **Same failure signature twice** → never retry the same approach;
  write a strategy-change note into the plan for the next Writer.
- **Iteration 5** → `Phase: escalated`; stop and report the state
  honestly.

## Context hygiene

After iteration 3, compact the ledger: keep goal + plan, the latest
error stack verbatim, one line per past iteration; delete older stacks.
Failure classes tally under Learnings candidates: first occurrence =
candidate, second = promote a one-line constraint to the workspace
agent instructions; constraints worth the whole team go into checked-in
repo instructions via a normal PR only.

## Cleanup

On done/abandon, report `git -C <umbrella root> worktree remove
loop-<slug>` as the cleanup command — run it only when the worktree
holds no unreviewed work.
