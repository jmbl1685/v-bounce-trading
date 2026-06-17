# Formatting Rules
- Always use 4-space indentation (or 2-space for JSON/JS/React).
- Ensure consistent spacing around brackets, parentheses, and operators.
- Write clean, semantic code; never generate spaghetti code or nested pyramids of doom.
- Do not add trailing whitespace.
- Do not use semicolons (`;`) to terminate statements; rely on automatic semicolon insertion.
- Use single quotes (`'`) for strings instead of double quotes (`"`); use template literals for interpolation.
- Prefer arrow functions assigned to `const` (e.g. `const ddd = () => ...`) instead of `function` declarations.

# Tooling
- Package manager is **pnpm**. Always use `pnpm` — never `npm` (or `yarn`). e.g. `pnpm install`, `pnpm add <pkg>`, `pnpm run build`, `pnpm dev`.

# Git / Commits
- Every commit message follows the format `[TYPE]: short imperative description` (e.g. `[FIX]: correct breed parsing`).
- `TYPE` is UPPERCASE, one of: `ADD`, `FIX`, `UPDATE`, `REMOVE`, `REFACTOR`, `DOCS`, `STYLE`, `TEST`, `CHORE`.
- Use the `/commit` command (or the `commit` skill) to stage, commit, and push following this standard.

# Frontend / React
- Stack: React + TypeScript, built with Vite.
- Every component lives in its own folder named after the component, containing `ComponentName.tsx` and `ComponentName.scss`. Never place a bare `ComponentName.tsx` directly in a shared folder.
- Use Sass (`.scss`) for all styling. Share design tokens via `src/styles/_variables.scss` and `@use` them in component stylesheets.
- Components are arrow-function components typed with their props interface.
- Always support BOTH light and dark mode. Drive theming with CSS custom properties defined under `:root` (light) and `:root[data-theme='dark']` (dark) in `global.scss`; component styles must reference these `var(--token)`s and never hard-code theme-specific colors. See the `theme-support` skill.
