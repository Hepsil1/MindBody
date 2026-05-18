---
name: web-design-fundamentals
description: Distilled principles from Refactoring UI (Wathan/Schoger), Material Design 3, and Apple HIG — the universal grammar of good web UI. Use when explaining WHY a design choice works, or when you need a quick reality-check before recommending a pattern. Not a substitute for taste, but a guardrail against obvious mistakes.
---

# Web Design Fundamentals

Concise principles, organised by what they answer. When in doubt, this
is the reference.

## Hierarchy: what does the eye land on first?

A good page has a clear F-pattern or Z-pattern of focal points.

- **Size > weight > color > spacing** is the priority ladder for
  signalling importance. Bigger always wins over bolder, bolder always
  wins over redder, etc. Don't fight a bigger neighbor with weight or
  hue — make it bigger or accept it's the focal point.
- **One primary action per screen.** If everything is a CTA, nothing is.
- **Visual weight should match logical importance.** A "delete account"
  button shouldn't look identical to "edit profile".

## Type: the most overlooked driver of quality

From Refactoring UI:

- **Pair fonts by contrast, not similarity.** Two serifs that "look
  similar" read as a mistake. One serif + one sans (our Cormorant + DM
  Sans) reads as intentional. ✅
- **Don't center body paragraphs of more than 2 lines.** Center align
  is for short hero lines and small UI labels, not for prose.
- **Use a real type scale (1.25x, 1.333x, 1.5x ratios), not arbitrary
  px values.** Our scale (`--text-xs` through `--text-6xl`) is roughly
  1.25x — keep it.
- **Smaller text needs more line height.** 14-16px body wants 1.5-1.6
  leading; 32-56px display wants 1.0-1.2.
- **Limit line length.** Body paragraphs should be 45-75 characters
  per line — beyond that, the eye loses its place returning to the
  start of the next line.
- **Increase letter-spacing on uppercase.** Always. Uppercase has more
  visual density; without tracking it reads as "I am yelling".

## Color: subtle moves beat bold ones

- **Most of the page is grey.** True bright colors get reserved for
  primary action, sale states, and key data. Look at any Aesop or
  Lemaire site — there's almost no color.
- **Saturate-and-darken or desaturate-and-lighten — never both at
  once.** That's why color picker "lightness" sliders produce washed
  hues. Use HSL where lightness is paired with carefully chosen
  saturation per color.
- **One brand color is rarely enough.** You need a primary (CTA),
  a secondary/accent, a state color (error/success/warning), and a
  neutral scale. Our palette has all four — use them, don't reach
  for a new hex.
- **Borders are color, too.** A single 1px hairline in
  `--color-border` is often the difference between "premium" and
  "shipped from a Wix template".

## Space: empty space is content

- **Padding > the element itself for breathing room.** A card with
  the right padding looks more expensive than the same card with a
  fancier shadow.
- **Whitespace tells the eye where one thing ends and another
  begins.** Borders and dividers are noise; whitespace is signal.
- **Use a real spacing scale (Tailwind/Material both use ~4px-based,
  we use the same).** Custom px values create visual jitter.
- **More space at the top of the page than the bottom of the page,
  more at section boundaries than between siblings.** Vertical rhythm.

## Imagery

- **Crops matter more than the image itself.** A great photo with a
  bad crop looks worse than a mediocre photo well-cropped.
- **Consistent aspect ratios across a grid.** Mixing 4:5 portraits
  with 1:1 squares in the same product grid breaks the rhythm — the
  card-position fix has to wait until everything is the same ratio.
- **People photos > flat-lay > product-on-white** for emotional
  connection. Use lifestyle for hero, flat-lay for grid, on-white for
  cart thumbnails.
- **Compress aggressively for the web.** WebP at quality 85 is
  indistinguishable from PNG at 1/10 the size. AVIF is better still
  but support is patchier.

## Motion (Material 3 + Apple HIG agree)

- **Motion has a job: orienting the user.** A drawer slides in from
  the right because that's where the cart icon lives. A modal scales
  up from the trigger button so the user understands the connection.
  If the motion doesn't explain "where did that come from?", remove it.
- **Fast in, slow out** (`cubic-bezier(0.05, 0.7, 0.1, 1)` or our
  `--transition-spring`). Exits feel snappier than entrances; reverse
  feels broken.
- **Durations:** 150-200ms for UI (hover, tap), 300-400ms for layout
  (drawer, modal), 500ms+ feels slow. Anything over 700ms gets
  perceived as "the app is broken".
- **Respect `prefers-reduced-motion`** absolutely. We do this in
  `SmartSunParticles.tsx` — apply the same pattern to any new
  animation > 200ms.

## Interactive states

From Apple HIG:

- **Default → Hover → Pressed → Focused → Disabled.** Every
  interactive element gets all five. If your button doesn't have a
  pressed state, it doesn't feel real.
- **Hover and Focus often share styling on web** (because keyboard
  users need the same affordance), but the actual key is **visible
  focus ring**.
- **Disabled state is muted color + cursor: not-allowed**, never
  invisible.

## Forms

From both Refactoring UI and Material 3:

- **Labels above fields, not beside.** Faster to scan, doesn't break
  on mobile, works for long labels.
- **Don't make labels disappear.** Floating-label patterns can work,
  but only when the label visibly shrinks and moves — it must never
  vanish completely.
- **Error inline, immediately, but only after blur.** Don't yell at
  the user mid-typing.
- **Use the right input type.** `type="email"` gives mobile users the
  right keyboard. `inputmode="numeric"` for OTP. `autocomplete=...`
  for known fields.

## Mobile-specific principles

- **Thumb zone first.** Primary actions in the bottom third of the
  screen.
- **Touch targets ≥ 44px.** Spacing between targets ≥ 8px.
- **No hover-only affordances.** If clicking requires hovering first,
  it's broken on mobile.
- **Bottom sheets > centered modals.** Sheets feel native and respect
  the thumb zone.
- **Avoid carousels for primary content.** People don't swipe carousel
  slides 2+. If the info is on slide 3, it doesn't exist.

## Iconography

- **Pick one icon set and stick with it.** Mixing Material icons with
  Heroicons with custom SVGs reads as amateur. We have `lucide-react`
  installed — use it as the default.
- **Icons need labels** unless the meaning is universally known
  (X close, ← back, ⊕ add). Even then, `aria-label` is required.
- **Size icons relative to surrounding text, not in absolute px.**
  `em`-based sizing means an icon next to body copy and an icon next
  to a heading look proportionate.

## "Why is this design bad?" diagnostic questions

Run through these when something feels off but you can't articulate
why:

1. **Hierarchy:** Where does the eye land first? Is that the most
   important thing on the page?
2. **Type:** Is one piece of text doing too much? (E.g. trying to be
   the heading, the description, and the CTA all in one paragraph.)
3. **Color:** Are there more than 3 saturated hues on screen?
4. **Space:** Are unrelated things touching each other? Are related
   things separated?
5. **Alignment:** Do edges line up? (90% of "amateur" feeling is just
   mismatched alignment.)
6. **Consistency:** If this element appears elsewhere, does it look
   the same? Different border-radius on the same card = the brain
   reads as "broken".
7. **Mobile:** Have you scrolled the design at a phone width? If you
   don't know, you don't know.

## When to break the rules

Rules above produce competent design. Memorable design breaks one or
two of them deliberately. The key word is **deliberately**:

- A hero with a single huge serif word and zero else (breaks
  hierarchy of "one primary action") — only works if the page is
  brand-positioning, not transactional.
- All-uppercase body paragraph (breaks legibility) — works in very
  short editorial bursts, never for product descriptions.
- Tight kerning on display type (breaks tracking norm) — works for
  fashion-luxury voice, doesn't work for tech/SaaS.

Know which rule you're breaking and why. If you can't name the rule,
you're not breaking it on purpose; you're making a mistake.
