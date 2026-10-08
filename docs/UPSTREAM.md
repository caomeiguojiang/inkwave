# Upstream maintenance

## Ownership and deliberate differences

`upstream/main` tracks the author. `codex/assertok` is the deployed fork; use a
short-lived `codex/upstream-*` branch for each reviewed update. Preserve Git history.

| Area | Policy |
| --- | --- |
| Gameplay, stages, equipment, assets, bug fixes | Integrate compatible author updates and check interactions with fork performance/preparation changes. |
| Localization | Keep i18next, four independent catalogs, browser detection and native settings persistence. Adapt new author text/calls to this runtime. |
| Language UI / typography | Keep approved shared panel, flat rows, subtle separators, focus and selected feedback, no dropdown dots, regional Swei fonts. |
| Language switching | Keep Game/Match/HUD/session/socket identity. Do not import upstream HUD recreation. |
| Network | Take compatible logic improvements; adapt both Node and Worker relays and preserve protocol-2 preparation rules. |
| Build/deployment | Build off-host, use immutable releases and explicit 1Panel deployment. |

These are intentional product choices, not conflicts to erase automatically.
Never resolve an entire changed file with `ours`/`theirs`: the same menu or session
file can contain both an unwanted implementation and a useful fix.

## Two different checkpoints

- Git ancestry records commits actually merged.
- `upstream-review.json` records the exact author revision already reviewed, with
  accepted/adapted/declined decisions and source evidence.

Selective ports do not make the original commits ancestors. The status tool reports
both counts explicitly. It checks that the reviewed revision is still an ancestor
of the upstream tip; rewritten history stops the check for manual review.
Do not create an `ours` merge merely to make the unmerged count zero.

## Each update

1. Fetch with `node tools/upstream-status.mjs`. Inspect the diff from
   `last_reviewed_commit` to the new upstream tip as well as dependent earlier code.
2. Classify changed behavior, not just files: adopt, adapt to the fork, retain our
   alternative, or explicitly defer. Review all changed files before advancing the
   checkpoint; record deferred work with its reason.
3. Merge normally when the change is compatible. For mixed commits, port the
   relevant behavior into a focused commit and record upstream PR/SHA provenance.
4. Audit new/changed visible strings (including dynamic templates, aria labels,
   HUD and game prompts). `extract-i18n.mjs` only suggests candidates; it does not
   prove completeness. Update en/zh-Hans/zh-Hant/ja, then regenerate/check font subsets.
5. Run build, relay/error/preparation tests, language UI checks and real multiplayer
   with live language switching. Add scenario-specific checks for affected gameplay.
   Clean merges and nonempty catalogs alone do not establish behavior or translation quality.
6. Record review decisions and exact upstream SHA, merge the reviewed branch into
   `codex/assertok`, push, and release an immutable image only after acceptance.

## Cost and convergence

Most changes outside the differing modules remain straightforward. Changes to
menus/HUD/session require semantic review even without textual conflicts. There
is no safe fully automatic merge for two different designs of the same feature.
Keep fork changes focused and documented. Reassess a retained alternative when
upstream meets the same requirements; remove duplicate implementations deliberately
rather than layering adapters indefinitely. Sending general fixes upstream can
reduce future drift, but publishing a PR is a separate explicit action.
