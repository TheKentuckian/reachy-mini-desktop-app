# Style migration guide (internal - temporary)

This file is a cheat-sheet for the ongoing migration from ad-hoc inline
styling to the shared token system in `src/styles/`. Delete once the migration
is complete.

## 1. Imports

```ts
import {
  ACCENT,
  STATUS,
  DANGER,
  RADIUS,
  TYPO,
  FONT_WEIGHT,
  BLUR,
  DURATION,
  EASING,
  Z,
  accentAlpha,
  blackAlpha,
  whiteAlpha,
  hexToRgba,
  transition,
} from '@styles/tokens';
import { useAppPalette, scrollbarSx } from '@styles';
```

Inside the component:

```ts
const palette = useAppPalette();
```

`palette` is dark/light aware - **never branch on `darkMode` yourself anymore**.
Read the mode via `palette.isDark` only if you really need a truly mode-specific
literal (e.g. a radial gradient stop).

## 2. Mapping table

| Before                                                                    | After                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `'#FF9500'`, `'#FF9500'` (accent)                                         | `ACCENT.main`                                                            |
| `'#FFB74D'` (accent light)                                                | `ACCENT.light`                                                           |
| `'#E68A00'` (accent dark)                                                 | `ACCENT.dark`                                                            |
| `` `rgba(255, 149, 0, ${a})` ``                                           | `accentAlpha(a)`                                                         |
| `` `rgba(255, 255, 255, ${a})` ``                                         | `whiteAlpha(a)`                                                          |
| `` `rgba(0, 0, 0, ${a})` ``                                               | `blackAlpha(a)`                                                          |
| `darkMode ? '#f5f5f5' : '#333'`                                           | `palette.textPrimary`                                                    |
| `darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'`                  | `palette.textSecondary`                                                  |
| `darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'`                  | `palette.textMuted`                                                      |
| `darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'`                 | `palette.textFaint`                                                      |
| `darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'`                  | `palette.textDisabled`                                                   |
| `darkMode ? '#0f0f0f' : '#ffffff'`                                        | `palette.surfaceBg`                                                      |
| `darkMode ? 'rgba(25,25,25,0.95)' : 'rgba(255,255,255,0.95)'`             | `palette.surfaceCard`                                                    |
| `darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'`                 | `palette.border`                                                         |
| `darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'`                | `palette.borderStrong`                                                   |
| `darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'`                | `palette.divider`                                                        |
| `darkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)'` | `palette.shadowMd`                                                       |
| `darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.05)'` | `palette.shadowLg`                                                       |
| accent tinted surfaces idle                                               | `palette.accentSurface`                                                  |
| accent tinted surfaces hover                                              | `palette.accentSurfaceHover`                                             |
| accent tinted surfaces active/pressed                                     | `palette.accentSurfaceActive`                                            |
| soft accent border                                                        | `palette.accentBorder`                                                   |
| stronger hovered accent border                                            | `palette.accentBorderStrong`                                             |
| `0 6px 24px rgba(255,149,0,0.35)` (accent glow)                           | `palette.accentGlow`                                                     |
| green / success                                                           | `palette.statusSuccess` or `STATUS.success`                              |
| red / error                                                               | `palette.statusError`                                                    |
| amber / warning                                                           | `palette.statusWarning`                                                  |
| blue / info                                                               | `palette.statusInfo`                                                     |
| grey "stopped" / "not_initialized"                                        | `palette.statusNeutral`                                                  |
| purple "busy" / "moving" / "executing" / "app-running"                    | `palette.statusBusy`                                                     |
| `darkMode ? ACCENT.light : ACCENT.dark` (readable accent text)            | `palette.accentTextStrong`                                               |
| `transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'`                | `` `all ${DURATION.base}ms ${EASING.spring}` ``                          |
| `transition: 'all 0.15s ease'`                                            | `` `all ${DURATION.fast}ms ${EASING.standard}` `` or `transition('all')` |
| `borderRadius: 12`                                                        | `borderRadius: RADIUS.lg` (check value)                                  |

### 2.b Status surfaces (toasts, alerts, badges)

For tinted success / error / warning / info / neutral tiles (background + border +
readable text), use the `status*Surface|Border|Text` trio instead of open-coding
rgba variants:

| Before (typical toast / alert)                                        | After                          |
| --------------------------------------------------------------------- | ------------------------------ |
| `darkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)'`     | `palette.statusSuccessSurface` |
| `darkMode ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.3)'`      | `palette.statusSuccessBorder`  |
| `darkMode ? '#86efac' : '#16a34a'`                                    | `palette.statusSuccessText`    |
| `darkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'`     | `palette.statusErrorSurface`   |
| `darkMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'`      | `palette.statusErrorBorder`    |
| `darkMode ? '#fca5a5' : '#dc2626'`                                    | `palette.statusErrorText`      |
| `darkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)'`   | `palette.statusWarningSurface` |
| `darkMode ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.3)'`    | `palette.statusWarningBorder`  |
| `darkMode ? '#fde047' : '#ca8a04'`                                    | `palette.statusWarningText`    |
| `darkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)'`   | `palette.statusInfoSurface`    |
| `darkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)'`    | `palette.statusInfoBorder`     |
| `darkMode ? '#93c5fd' : '#2563eb'`                                    | `palette.statusInfoText`       |
| `darkMode ? 'rgba(156, 163, 175, 0.15)' : 'rgba(156, 163, 175, 0.1)'` | `palette.statusNeutralSurface` |
| `darkMode ? '#d1d5db' : '#6b7280'`                                    | `palette.statusNeutralText`    |

For any other custom alpha on a status color, use the generic helper:

```ts
import { hexToRgba, STATUS } from '@styles/tokens';
const progress = hexToRgba(STATUS.success, 0.8);
```

### 2.c Destructive "danger" buttons (reset / clear / delete)

Danger surfaces are **intentionally distinct** from `statusError`: lighter,
warmer, and meant for buttons that ask the user to confirm a destructive
action. Use this trio instead of the red variants you'd use for errors:

| Before                                                              | After                        |
| ------------------------------------------------------------------- | ---------------------------- |
| `darkMode ? '#f87171' : '#dc2626'`                                  | `palette.dangerText`         |
| `darkMode ? 'rgba(248, 113, 113, 0.5)' : 'rgba(220, 38, 38, 0.5)'`  | `palette.dangerBorder`       |
| `darkMode ? 'rgba(248, 113, 113, 0.1)' : 'rgba(220, 38, 38, 0.08)'` | `palette.dangerSurfaceHover` |

### 2.d Radii, typography, blur, scrollbars (non-color primitives)

Prefer the semantic tokens over raw literals so the app stays visually
consistent:

| Before                         | After                         |
| ------------------------------ | ----------------------------- |
| `borderRadius: '4px'`          | `borderRadius: RADIUS.xs`     |
| `borderRadius: '6px'`          | `borderRadius: RADIUS.sm`     |
| `borderRadius: '8px'`          | `borderRadius: RADIUS.md`     |
| `borderRadius: '10px'`         | `borderRadius: RADIUS.lg`     |
| `borderRadius: '12px'`         | `borderRadius: RADIUS.xl`     |
| `borderRadius: '16px'`         | `borderRadius: RADIUS.xxl`    |
| `borderRadius: '999px'` (pill) | `borderRadius: RADIUS.pill`   |
| `borderRadius: '50%'` (circle) | `borderRadius: RADIUS.circle` |

> ⚠️ **MUI gotcha**: `RADIUS.*` values are **px strings** on purpose. In MUI's
> `sx`, `borderRadius: <number>` is multiplied by `theme.shape.borderRadius`
> (default 4), which made tokens render 4× too large. Raw numbers
> (`borderRadius: 2` → 8px) are still valid if you intentionally want the
> multiplier.
> | `fontSize: 10` | `fontSize: TYPO.tiny` |
> | `fontSize: 11` | `fontSize: TYPO.xs` |
> | `fontSize: 12` | `fontSize: TYPO.sm` |
> | `fontSize: 13` | `fontSize: TYPO.body` |
> | `fontSize: 14` | `fontSize: TYPO.md` |
> | `fontSize: 16` | `fontSize: TYPO.lg` |
> | `fontSize: 18` | `fontSize: TYPO.xl` |
> | `fontSize: 20` | `fontSize: TYPO.xxl` |
> | `fontWeight: 400` | `fontWeight: FONT_WEIGHT.regular` |
> | `fontWeight: 500` | `fontWeight: FONT_WEIGHT.medium` |
> | `fontWeight: 600` | `fontWeight: FONT_WEIGHT.semibold` |
> | `fontWeight: 700` | `fontWeight: FONT_WEIGHT.bold` |
> | `backdropFilter: 'blur(8px)'` | `backdropFilter: BLUR.sm` |
> | `backdropFilter: 'blur(10px)'` | `backdropFilter: BLUR.md` |
> | `backdropFilter: 'blur(40px)'` | `backdropFilter: BLUR.lg` |
> | `transition: 'all 0.2s ease'` | `transition: transition('all', DURATION.base)` |
> | `transition: 'opacity 0.3s ease'` | `transition: transition('opacity', DURATION.slow)` |
> | `transition: 'X 0.15s ease'` | `transition: transition('X', DURATION.fast)` |
> | `'a 0.2s ease, b 0.2s ease'` | `transition: transition(['a','b'], DURATION.base)` |
> | hand-rolled `'&::-webkit-scrollbar': { ... }` block | `...scrollbarSx(palette)` |

`scrollbarSx` accepts options: `scrollbarSx(palette, { width: 8, thumb, thumbHover })`.
Use it for terminal-style surfaces that need explicit colors.

One-offs (non-standard durations like `0.05s / 0.25s linear`, non-standard
blurs like `blur(20px)`, or fontSizes like `15` / `17`) can stay as literals
unless they become common enough to deserve a token.

### 2.e Neutral greys (helpers, labels, metadata)

Most ad-hoc `darkMode ? '#aaa' : '#666'` / `darkMode ? '#888' : '#999'` mappings
fold into the existing semantic text tokens:

| Before                                                  | Recommended token       |
| ------------------------------------------------------- | ----------------------- |
| `darkMode ? '#aaa' : '#666'` (label)                    | `palette.textSecondary` |
| `darkMode ? '#888' : '#888'` / `'#888'` (neutral state) | `palette.statusNeutral` |
| `darkMode ? '#666' : '#999'` (helper / counter)         | `palette.textMuted`     |
| `darkMode ? '#555' : '#bbb'` (strong muted, chips)      | `palette.textFaint`     |
| `darkMode ? '#333' : '#ddd'` (1px divider)              | `palette.border`        |

When the visual needs are genuinely bespoke (different RGB triplets, not just a
lighter/darker pair), leave a `// TODO(style-migration)` comment and branch on
`palette.isDark` rather than reintroducing a `darkMode` prop.

## 3. Rules of thumb

1. **Never hardcode** accent colors (`#FF9500`, `rgba(255,149,0,x)`) - always go
   through `ACCENT.main` or `accentAlpha(x)`.
2. **Never branch on `darkMode`** for plain text / surface / border colors -
   pick the right semantic palette token instead. Branch on `palette.isDark`
   only when the two variants are genuinely not captured by a semantic token
   (e.g. different gradient stops).
3. **Do NOT touch the foundation**: `src/styles/tokens.ts`, `src/styles/palette.ts`,
   `src/styles/useAppPalette.ts`, `src/styles/index.ts`, `src/main.tsx`.
4. **Do NOT remove `darkMode` props** from component public APIs. Mark them
   `@deprecated` in the `Props` interface, stop reading them internally, and
   drop them from the destructuring. Callers keep working.
5. **Prefer palette helpers over raw `darkMode` branches** even for things like
   gradient stops - if the palette doesn't have it yet, still call `useAppPalette()`
   and branch on `palette.isDark`, not on a local `darkMode` prop.
6. **Keep prop names stable** - only internal implementation changes.
7. **Run `npm run typecheck` + `npx eslint --fix <your-paths>`** on the files
   you touched before finishing. Fix any error you introduced.

## 4. Before / after sample

### Before

```tsx
import { useAppStore } from '@store/appStore';

export function Foo() {
  const darkMode = useAppStore(s => s.darkMode);
  return (
    <div
      style={{
        color: darkMode ? '#f5f5f5' : '#333',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
        background: 'rgba(255, 149, 0, 0.15)',
        boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)',
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <span style={{ color: '#FF9500' }}>Hello</span>
    </div>
  );
}
```

### After

```tsx
import { ACCENT, DURATION, EASING, accentAlpha } from '@styles/tokens';
import { useAppPalette } from '@styles';

export function Foo() {
  const palette = useAppPalette();
  return (
    <div
      style={{
        color: palette.textPrimary,
        border: `1px solid ${palette.border}`,
        background: accentAlpha(0.15),
        boxShadow: palette.shadowMd,
        transition: `all ${DURATION.base}ms ${EASING.spring}`,
      }}
    >
      <span style={{ color: ACCENT.main }}>Hello</span>
    </div>
  );
}
```

## 5. MUI `sx` prop

Same rules - just pass the palette tokens via the `sx` prop:

```tsx
<Box sx={{ color: palette.textPrimary, bgcolor: palette.surfaceCard }} />
```

## 6. When unsure

If the current color has no clear semantic token yet, stop and leave the code
as-is with a `// TODO(style-migration): add palette token` comment rather than
inventing a random mapping. The foundation will be iterated after the bulk
migration.
