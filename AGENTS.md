# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-20 14:51:55
**Commit:** 9959a33
**Branch:** master

## OVERVIEW
Koishi plugin for Minecraft version notifications. Pulls Mojang metadata, summarizes changelogs via AI, broadcasts to channels, and exports PCL-compatible XAML.

## STRUCTURE
```text
minecraft-notifier/
|- src/                  # Source of truth for runtime logic
|  |- helper/            # Reusable helpers (URL, web, OneBot, XAML, GitCode)
|- lib/                  # Build output (bundled CJS + declarations)
|- dist/                 # Extra artifacts packaged for distribution
|- .github/workflows/    # Release automation
|- esbuild.config.js     # Bundles src/index.ts -> lib/index.cjs
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Runtime code paths | `src/AGENTS.md` | Per-file routing for plugin flow, AI, XAML, and prompts |
| Helper and integration utilities | `src/helper/AGENTS.md` | URL, OneBot, web, XAML, and GitCode helper guidance |
| Build and release entry points | `package.json`, `esbuild.config.js`, `.github/workflows/release.yml` | Scripts, bundling, CI release automation |

## CONVENTIONS
- Runtime code lives in `src`; `lib` is generated from `build` script.
- Toolchain is `oxlint` + `oxfmt` (not ESLint/Prettier).
- Formatting: single quotes, tab width 2, trailing comma `es5`.
- TypeScript compiles declarations only (`tsc --emitDeclarationOnly`) after esbuild bundle.
- Release branch is `master`; semantic-release rules include custom `imp` type.

## ANTI-PATTERNS (THIS PROJECT)
- Do not hand-edit `lib/*`; rebuild from `src/*` via `pnpm run build`.
- Do not plan validation around tests; this repo currently validates changes with `pnpm run lint` and `pnpm run build`, not a test script.
- Do not add broad lint assumptions from default presets; project intentionally disables several correctness/unicorn rules in `.oxlintrc.json`.
- Do not duplicate large prompt templates without intent; `src/prompt-const.ts` already contains repeated blocks and is high-risk for drift.

## UNIQUE STYLES
- Category order for summaries is stable and semantic (`new_features` -> `technical_changes`).
- Notification path uses OneBot forward nodes, not plain single-message dumps.
- Supports optional GitCode upsert flow for `Custom.xaml` and `Custom.xaml.ini`.

## COMMANDS
```bash
pnpm install
pnpm run lint
pnpm run lint:fix
pnpm run fmt
pnpm run build
pnpm run release
```

## NOTES
- CI release job runs only on `master` push (`.github/workflows/release.yml`).
- `pnpm-workspace.yaml` exists in a single-package repo; keep command examples workspace-safe.
- LSP symbol indexing was unavailable in this environment; rely on file-path map above for navigation.
