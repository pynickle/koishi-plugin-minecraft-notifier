# SOURCE DOMAIN GUIDE

**Scope:** `src/*` only. Root AGENTS rules still apply.

## OVERVIEW

Runtime pipeline: detect version -> fetch article -> summarize with AI -> notify channels -> export XAML.

## STRUCTURE

```text
src/
|- index.ts                # Koishi plugin entry and schema
|- version-checker.ts      # Poll Mojang manifest + detect version changes
|- changelog-summarizer.ts # Scrape article, summarize, send forward messages
|- ai-client.ts            # Provider setup, model fallback, schema validation
|- xaml-generator.ts       # PCL XAML generation + optional GitCode upsert
|- translation-fetcher.ts  # Wiki/GitCode translation merge for prompts
|- prompt-const.ts         # System prompt template for JSON summarization
|- helper/                 # Shared utility layer
```

## WHERE TO LOOK

| Task                                   | Location                      | Notes                                                |
| -------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Add plugin config fields               | `src/index.ts`                | Keep `Config` interface and `Schema` aligned         |
| Adjust poll cadence/logic              | `src/version-checker.ts`      | Includes retry/backoff and notify behavior           |
| Change summary output grouping         | `src/changelog-summarizer.ts` | Category order + OneBot forward nodes                |
| Change AI routing or fallback          | `src/ai-client.ts`            | `generateObject` primary, web-search fallback        |
| Change prompt constraints              | `src/prompt-const.ts`         | Large template; avoid accidental duplication         |
| Change XAML output/upload              | `src/xaml-generator.ts`       | Writes local files and optionally GitCode            |
| Change translation merge/input shaping | `src/translation-fetcher.ts`  | Merges wiki and GitCode text used by prompt pipeline |

## CONVENTIONS

- Keep cross-module call graph linear: checker -> summarizer -> xaml export.
- Preserve category key order expected by downstream formatting.
- Keep DB table names stable (`minecraft_notifier`, `minecraft_article_version`, `minecraft_article_record`).
- Keep prompt output contract JSON-only; parser assumes strict schema.

## ANTI-PATTERNS

- Do not bypass zod validation in `src/ai-client.ts`; invalid summaries must be rejected.
- Do not reorder category keys unless you also update render/notify consumers.
- Do not introduce hard-coded paths outside Koishi `ctx.baseDir` data scope.
