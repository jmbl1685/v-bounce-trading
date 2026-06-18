---
name: i18n
description: Add or change user-facing text in the bilingual (English/Spanish) i18n catalog. Use whenever adding a UI string, label, tooltip, or message — ensures the key is added to BOTH language blocks with parity so nothing renders as a raw key.
---

# i18n (EN/ES parity)

All user-facing text lives in `src/i18n/translations.ts` as **two parallel objects** — an
English block and a Spanish block — keyed by dotted namespaces (e.g. `strategy.<id>.name`,
`card.entry`, `pt.balance`, `how.title`). Components read them via `useI18n()` → `t('key')`.

**The cardinal rule:** every key must exist in **both** blocks. A missing key renders as the
raw key string (e.g. literally `strategy.foo.name`) — there is no build error for it, so it's
easy to ship. Always edit both.

## Steps

1. **Never hardcode** user-facing strings in a component. Add a key and use
   `const { t } = useI18n()` → `t('namespace.key')`.
2. Add the key to the **English** block, then the **Spanish** block, at the same logical spot
   (keep the two blocks in parallel order so they're easy to diff).
3. **Interpolation:** use `{name}` placeholders and pass values:
   `t('addAsset.errExists', { sym: symbol })`. Use the *same* placeholder names in both languages.
4. **Markup:** values may contain `<b>…</b>` / `<i>…</i>` (rendered via `dangerouslySetInnerHTML`
   where the component opts in). Escape literal angle brackets as `&lt;` / `&gt;`.
5. **Dynamic keys:** some UI builds keys at runtime (e.g. `t(\`strategy.${id}.name\`)`). If you add a
   new id/variant, add every derived key (`.name`, `.tagline`, `.intro`, `.b1`…) in both blocks.
6. Verify: `pnpm build`, and grep the new key — it must appear **twice** (once per block).

## Conventions

- Keep translations natural, not literal — match the tone of nearby Spanish strings.
- Reuse existing keys instead of duplicating (e.g. `card.entry`, `card.target`, `pt.close`).
- Number/price formatting is **not** translated — it's handled by `src/utils/format.ts`.
- `t` is typed `(k: string, v?: Record<string, string | number>) => string`, so any string key
  compiles — correctness is on you; the parity check is manual (grep both blocks).
