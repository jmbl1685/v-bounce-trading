---
name: scaffold-component
description: Create a new React component following this repo's strict conventions — own folder, ComponentName.tsx + ComponentName.scss, arrow-function component, light/dark theming via CSS custom-property tokens, and i18n. Use whenever adding any new UI component.
---

# Scaffold a component

Frontend stack: **React + TypeScript + Vite + Sass**. The rules below are from `CLAUDE.md` and
the existing components — match them exactly so UI never drifts.

## Layout

Every component lives in **its own folder** named after it:

```
src/components/ComponentName/
  ComponentName.tsx
  ComponentName.scss
```

Never put a bare `ComponentName.tsx` directly in a shared folder.

## The .tsx

- **Arrow-function component** typed with its props interface — not a `function` declaration:
  ```tsx
  import { useI18n } from '../../context/I18nContext'
  import './ComponentName.scss'

  interface ComponentNameProps {
      value: number
      onChange: (v: number) => void
  }

  export const ComponentName = ({ value, onChange }: ComponentNameProps) => {
      const { t } = useI18n()
      return <div className='component-name'>{t('some.key')}</div>
  }
  ```
- Single quotes, **no semicolons**, arrow-functions assigned to `const`, 4-space indent (match
  surrounding files).
- **No hardcoded user-facing text** — use `useI18n()` `t()` and add keys to both language blocks
  (see the `i18n` skill).
- A portal modal? `createPortal(<…>, document.body)` with an overlay `onClick={onClose}` and an
  inner panel `onClick={(e) => e.stopPropagation()}` (see `StrategyInfoModal`).

## The .scss

- Start with `@use '../../styles/variables' as *;` to pull in `$space-*`, `$radius-*`, `$font-mono`, etc.
- **BEM-ish** nesting under the root class: `&__element`, `&--modifier`, `&.is-state`.
- **Theming is mandatory — light AND dark.** Reference CSS custom properties only:
  `var(--surface)`, `var(--surface-2/3)`, `var(--text)`, `var(--text-dim/faint)`, `var(--border)`,
  `var(--accent)`, `var(--long)`, `var(--short)`, `var(--cyan)`, … These are defined in
  `global.scss` under `:root` (light) and `:root[data-theme='dark']` (dark). **Never hardcode a
  theme-specific hex color** — if you need a tint, use `color-mix(in srgb, var(--token) X%, transparent)`.
  See the `theme-support` skill.

## Verify

`pnpm build`. Check the component in both light and dark mode (toggle in the header).
