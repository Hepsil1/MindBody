# MindBody project-scoped skills

These four skills travel with the repo. Any Claude Code session opened
inside `C:\mindbody` automatically gets them — no per-machine setup
needed.

| Skill | Triggers when | What it gives you |
|---|---|---|
| `mindbody-design-system` | building / reviewing UI on this site | Full color palette, type scale, spacing tokens, radii, shadows, motion, z-index — all sourced from `app/app.css`. The contract, not a suggestion. |
| `mindbody-a11y-audit` | reviewing or building customer-facing UI | 7-check WCAG 2.2 AA workflow with contrast tables against our actual cream/teal palette, e-commerce-specific gotchas (size selectors, sale price, free-shipping threshold). |
| `ecommerce-cro-principles` | reviewing PDP / cart / checkout / any "would this lose a sale" flow | Distilled from Baymard + tuned for the Ukrainian market (Nova Poshta, COD, premium positioning). Tells you what to keep, what to add, what to never do. |
| `web-design-fundamentals` | explaining WHY a design works, or sanity-checking a recommendation | Refactoring UI (Wathan/Schoger) + Material 3 + Apple HIG distilled into one-paragraph principles per topic. The grammar of good UI. |

## How they activate

Claude reads each `SKILL.md` frontmatter at the start of a session.
When the conversation touches a topic in the `description:` line, the
skill auto-loads. You can also invoke a skill explicitly by name.

## How to add more

```
.claude/skills/
  <short-kebab-name>/
    SKILL.md       # frontmatter: name + description, then markdown content
```

Keep descriptions short and trigger-y ("use when X happens") — that's
what Claude pattern-matches on. Long descriptions don't help; they
hurt because they dilute the trigger signal.

## Companion: `.mcp.json` (project root)

Activates Chrome DevTools / Playwright / Context7 MCP servers for
this project. Lighthouse audits, screenshot diffs, and current-version
library docs become available to any Claude Code session here.
