# HELPER DOMAIN GUIDE

**Scope:** `src/helper/*` only. Inherits root + `src/AGENTS.md`.

## OVERVIEW

Utility layer for deterministic transforms and integrations: URL formatting, HTTP headers, OneBot node shape, XML escaping, GitCode upsert.

## WHERE TO LOOK

| Task                           | Location                            | Notes                                   |
| ------------------------------ | ----------------------------------- | --------------------------------------- |
| Build article URL from version | `src/helper/article-helper.ts`      | Handles snapshot/pre/rc naming variants |
| Build forward-message node     | `src/helper/onebot-helper.ts`       | Returns OneBot `node` payload shape     |
| Random browser UA selection    | `src/helper/web-helper.ts`          | Centralized UA pool                     |
| Escape user text for XAML      | `src/helper/xaml-helper.ts`         | Must preserve XML-safe output           |
| Upsert content to GitCode repo | `src/helper/git-platform-helper.ts` | Existence check + create/update flow    |

## CONVENTIONS

- Keep helper APIs side-effect-light unless file name implies network I/O.
- Keep return types explicit for integration helpers.
- For GitCode API calls, preserve `access_token` query + bearer header pairing used by current endpoints.

## ANTI-PATTERNS

- Do not embed business flow in helpers; orchestration belongs in `src/*` non-helper modules.
- Do not change payload field names for OneBot nodes without adapting sender calls.
- Do not remove XML escaping steps from `xaml-helper`; XAML generation depends on full escaping.
