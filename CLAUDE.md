# web

Part of the huvudkontoret workspace. Start with:

```bash
hk context web
```

Then read `CONTEXT.md` (domain language) and `AGENTS.md` (agent notes).
Decisions live in `docs/adr/`, designs in `docs/specs/`, operations in
`docs/runbooks/`. Conventions: conventional commits, trunk-based development
on `main` in the umbrella worktree layout.

## Everything written about the code is in English

Commit messages, code, comments, documentation, PRs and issues — always, in
every project. Some repos carry long Swedish histories from before this rule
(`kl` most of all); they are never the style reference, so never read
`git log` to decide what language to write in.

Product content is exempt: user-facing strings and domain grammars stay in
whatever language the product needs — kl's Swedish `PhraseParser` is correct
as it is. If developers and agents read it, it is English; if end users read
it, it follows the product.
