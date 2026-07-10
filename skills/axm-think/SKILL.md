---
name: axm-think
description: Reason through a problem by emitting your thinking as typed AXM statements (observation, question, hypothesis, option, decision, assumption, risk, unknown, conclusion, next) linked with @refs, instead of prose chain-of-thought. Use when the user wants structured, auditable reasoning, asks you to "think in axm", or is working a hard design/debugging problem where the reasoning should be a linked graph rather than a stream.
---

Reason in AXM. Instead of prose chain-of-thought, express your thinking as a sequence of typed, named `.axm` statements linked with `@refs`. Every thought gets a type and an ID, and later thoughts cite the earlier ones they depend on. This turns linear reasoning into an auditable graph: a `decision` points back at the `observation`s and `option`s that produced it; a `risk` hangs off the choice it threatens.

## Thinking vocabulary

Use these types. Don't invent new ones unless a thought genuinely fits none of them.

```axm
type observation "a fact noticed from the code, context, or user — not yet interpreted"
type question    "something that must be answered to make progress"
type hypothesis  "a tentative explanation or answer, to be confirmed or refuted"
type option      "a candidate approach under consideration"
type decision    "a choice made, citing the observations and options that drove it"
type assumption  "something taken as true without proof — a liability if wrong"
type constraint  "a fixed limit the solution must respect"
type risk        "something that could derail the chosen path"
type unknown     "an open question left unresolved for now"
type conclusion  "a synthesized result or answer"
type next        "a concrete next action"
```

## How to emit thoughts

Write statements in a fenced `axm` block, one per line, in the form `<type> <id> "<value>"`:

```axm
observation obs1 "the tokenizer and line-parser both hardcode the stmt: prefix"
question q1      "is the prefix load-bearing anywhere, or pure noise per @obs1"
hypothesis h1    "@q1 — it is pure noise; the type token already disambiguates"
option opt-keep  "keep stmt: for backwards compatibility with existing .axm files"
option opt-drop  "drop stmt:; migrate existing files with a codemod"
decision d1      "adopt @opt-drop because @h1 holds and there are no external .axm files yet"
risk r1          "@d1 breaks any user files created before the migration"
next n1          "grep the repo for 'stmt:' to bound the blast radius of @d1"
```

Rules that make the graph worth building:

- **ID every thought and reference the ones it builds on.** A `decision` that cites no `option` or `observation` is just an assertion — link it with `@id`. The value of thinking this way *is* the links.
- **Separate observing from concluding.** Put raw facts in `observation` before jumping to `hypothesis`/`decision`. This exposes leaps you'd otherwise hide in prose.
- **Name your `assumption`s explicitly.** The ones you don't write down are the ones that burn you. If a decision rests on an unproven belief, give it an `assumption` ID and let the decision cite it.
- **Let `question` → `hypothesis` → `decision` chains carry the load.** Open a `question`, answer it with a `hypothesis`, then either promote it to a `decision`/`conclusion` or leave it as an `unknown`. Don't resolve questions silently.
- **Use short generated IDs** (`obs1`, `q1`, `d1`) for transient reasoning; use descriptive slugs (`opt-drop`) when a thought is referenced repeatedly.
- Keep each value to one clear claim. If a thought needs "and", it's probably two statements.

## When to think in AXM

- Hard design decisions with multiple viable approaches — the `option`/`decision`/`risk` types force you to name the trade-off instead of burying it.
- Debugging — `observation` → `hypothesis` → `next` maps directly onto the debugging loop and keeps refuted hypotheses on the record.
- Anywhere the user asks to "think in axm" or wants the reasoning to be inspectable after the fact.

For a quick factual answer, don't bother — the ceremony isn't worth it. Reach for this when the reasoning is the deliverable.

## Optional: persist the reasoning

By default, emit the `axm` block inline in your response — no files touched. If the user wants the reasoning kept, persist it to a scratch KB so it can be queried, referenced, and grown later:

```
axm init thinking/            # scaffolds types.axm + axmconfig.json (once)
axm add "<value>" thinking/ --type observation --id obs1 --json
```

Once persisted, the `axm` skill's tools apply: `axm refs @d1 thinking/` shows everything that depends on a decision, `axm search` finds prior thoughts, and a plan KB can `@ref` these thought IDs. If you first need the thinking-type declarations in a KB, add the `type` block above to its `types.axm`.

## Closing a reasoning pass

End with the load-bearing nodes, not a prose summary: state the `decision`/`conclusion` IDs, then flag any `unknown` or `risk` still open. If a `question` never reached a `hypothesis` or `decision`, say so — an unclosed question is a gap in the reasoning, not something to paper over.
