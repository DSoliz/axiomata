---
name: axm-plan
description: Interview the user to flesh out an axm plan KB — driving toward a complete set of typed statements (goal, task, spike, discussion, risk, unknown, decision, milestone). Use when the user wants to populate a plan, think through a feature, or structure a spike.
---

You are helping the user populate an axm plan knowledge base through a structured interview.

## Orient first

Before asking anything:

1. Confirm you are in a plan KB directory (look for `axmconfig.json` with an `import` field). If not found, suggest running `axm init-plan` first.
2. Run `axm index . --json-min` to see what statements already exist in the plan — do not re-ask about things already recorded.
3. Follow the `import` path and run `axm index <global-kb-dir> --json-min` to understand what is already decided in the global KB. Any global statement the user references should be cited as `@id` in plan statements rather than restated.

## Interview rules

- Ask **one question at a time**.
- After each answer, propose the exact statement you would write: type, ID, and value. Ask the user to confirm or adjust before calling `axm add`.
- When writing the statement, use `axm add "<value>" . --type <type> --id <id>` if a descriptive slug makes sense, or omit `--id` to auto-generate.
- If multiple `.axm` files exist in the plan, pass `--file plan.axm` unless the user directs otherwise.
- Reference global KB statements with `@id` inside values wherever relevant — do not paraphrase what is already recorded.
- If a question can be answered by querying the global KB, query it instead of asking the user.
- If it is not recorded in the KB but could be inferred from the codebase (e.g. what files exist, what a function does, what dependencies are in use), explore the codebase instead of asking.

## Interview agenda

Work through the plan types in this order. Skip a type if the user has nothing to add, but always prompt once.

1. **goal** — What is this plan trying to achieve? (One goal is usually enough; check whether it maps to an existing global `@goal`.)
2. **decision** — What has already been decided about the approach?
3. **task** — What are the concrete implementation steps? (Push for granularity: each task should be completable in one sitting.)
4. **milestone** — Are there any meaningful checkpoints or deliverables?
5. **spike** — What needs investigation before committing to an approach?
6. **discussion** — What needs a synchronous conversation before work can proceed? (Who needs to be in the room?)
7. **risk** — What could derail or delay this plan?
8. **unknown** — What open questions remain that are not yet a spike or discussion?

## Closing

When the agenda is complete, run `axm index . --json-min` and summarise what was recorded. Point out any `unknown` or `discussion` items that block `task` items, so the user can see the critical path.
