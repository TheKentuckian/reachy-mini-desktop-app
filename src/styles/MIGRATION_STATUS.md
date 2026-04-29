# Style migration - Handoff note

**Status (2026-04-21): mechanical migration complete. Cleanup / follow-up
items only from this point on.**

## TL;DR

- **Foundation**: stable. `src/styles/{tokens,palette,useAppPalette,scrollbar,index}.ts`
  are the single source of truth. The MUI theme in `src/main.tsx` reads from
  the same primitives.
- **Mechanical passes (`darkMode ? A : B` + literal constants): DONE**.
  Whole-app token coverage now includes color, radius, typography size /
  weight, backdrop blur, transition helper, and a scrollbar helper.
- **Typecheck**: green.
- **Bundle-wide code reduction**: `src/` lost ~600 net lines of hand-rolled
  styling (see `git log` on `refactor/style-tokens`).

## Tokens now available

Import surface (`@styles` + `@styles/tokens`):

```ts
import {
  ACCENT,
  STATUS,
  STATUS_TEXT,
  DANGER,
  RADIUS,
  TYPO,
  FONT_WEIGHT,
  BLUR,
  DURATION,
  EASING,
  Z,
  LETTER_SPACING,
  BREAKPOINT,
  accentAlpha,
  blackAlpha,
  whiteAlpha,
  hexToRgba,
  transition,
} from '@styles/tokens';
import { useAppPalette, scrollbarSx } from '@styles';
```

| Concern                 | Token(s)                                               |
| ----------------------- | ------------------------------------------------------ |
| Accent brand            | `ACCENT.{main,light,dark}`, `accentAlpha(a)`           |
| Semantic status         | `STATUS.{success,error,warning,info,neutral}`          |
| Status tiles            | `palette.status*Surface/Border/Text`                   |
| Destructive actions     | `palette.danger{Text,Border,SurfaceHover}`             |
| Text / surface / border | `palette.text*`, `palette.surface*`, `palette.border*` |
| Shadows                 | `palette.shadow{Md,Lg}`, `palette.accentGlow`          |
| Radii                   | `RADIUS.{xs,sm,md,lg,xl,xxl,pill,circle}`              |
| Font size               | `TYPO.{micro,tiny,xs,sm,body,md,lg,xl,xxl,hero}`       |
| Font weight             | `FONT_WEIGHT.{regular,medium,semibold,bold}`           |
| Backdrop blur           | `BLUR.{sm,md,lg}` (8px / 10px / 40px)                  |
| Durations / easings     | `DURATION.*`, `EASING.*`                               |
| Transitions             | `transition(prop, ms, easing)` helper                  |
| Scrollbars              | `...scrollbarSx(palette, options?)` spread             |

See [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) for the full before/after
mapping table.

## What shipped in this migration

1. **Pilot components** (hand-migrated, reference implementations):
   - `components/emoji-grid/*` (EmojiGrid, EmojiPicker, DiceIcon, EmotionWheel)
   - `components/viewer3d/SettingsOverlay.tsx`
   - `views/active-robot/right-panel/expressions/ExpressionsSection.tsx`
2. **Parallel bucket pass** (`refactor/style-tokens`, 6 agents):
   - LogConsole, Application store, Finding robot + setup, Active robot shell,
     Controller + sliders, Shared components + TODO cleanup.
3. **Token extension pass**:
   - Added `TYPO`, `FONT_WEIGHT` (existing), `BLUR`, `scrollbarSx` helper.
4. **Mechanical literal pass** (4 parallel agents on disjoint zones):
   - 80 files touched. `borderRadius` -89%, `fontSize` -83%, `fontWeight` -92%,
     inline `transition` -47%, inline `backdropFilter` -62%, scrollbar blocks
     -62%.

## What remains (small / optional)

### Legitimate "one-off" literals (leave as is)

- `transition: 'X 0.05s linear'`, `'X 0.25s linear'`, `'X 0.35s ease'`,
  `'X 0.15s'` (no easing), `'ease-in-out'` variants - non-standard durations
  or easings that don't map to our scale.
- `backdropFilter: 'blur(20px)' / 'blur(16px)' / 'blur(4px)'` - 4 occurrences
  total; add a token if they become more common.
- `fontSize: 7` / `15` / `17` / `24` / `28` / `32` - bespoke typography
  sizes (hero numbers, capped badges).
- `borderRadius: 2 / 3 / 5 / 7 / 14 / 20 / 24` - bespoke shape sizes.

### Intentional opt-outs

- **Terminal-style dark surfaces** use hand-rolled colors and scrollbars
  on purpose (always dark, not theme-aware):
  - `src/components/LogConsole/**`
  - `src/views/bluetooth-support/JournalWindow.tsx`
  - `src/views/log-viewer/LogViewerWindow.tsx`
- **Three.js viewer effects** (`components/viewer3d/effects/*`) branch on
  `darkMode` for WebGL material properties, not CSS - out of scope for a CSS
  token system.
- **`utils/viewer3d/applyRobotMaterials.ts`** - three.js-only `darkMode`
  branching.
- **MUI theme build** in `src/main.tsx` - foundational, reads tokens directly.

### Documented `TODO(style-migration)` comments

~60 remaining, each with a one-line explanation of why the literal cannot
map to an existing token yet (bespoke RGB triplets, mode-specific gradient
stops, terminal greys). They are intentionally left as comments so we can
either add tokens later or accept the divergence.

## Verification

```bash
cd reachy_mini_desktop_app

npm run typecheck

./scripts/style-migration-status.sh       # dashboard (ternary counts)
./scripts/validate-style-migration.sh     # one-shot validation
```

## Git state

- Branch: `refactor/style-tokens`.
- All commits follow conventional-commits; the migration arc is self-contained
  and can be reviewed linearly.
- `MIGRATION_GUIDE.md` is the reference cheat-sheet; keep it in sync when
  adding new tokens.

## What NOT to do

- Don't force-push to `github` remote (ever).
- Don't remove `darkMode` props from public component APIs. Mark them
  `@deprecated` and stop destructuring them internally - callers still compile.
- Don't invent new palette tokens ad hoc. If a new token is warranted, add it
  to `tokens.ts` / `palette.ts` + document it in `MIGRATION_GUIDE.md` in the
  same commit.
- Don't rewrite the intentional opt-outs (terminal-style panels, Three.js
  material branches). They're documented above on purpose.
