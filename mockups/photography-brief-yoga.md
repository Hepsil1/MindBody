# Photography Brief — Yoga category

Internal style guide for selecting / shooting / curating photography
for MindBody's **Yoga** category surface (category card on home, hero
band on /shop/yoga, slide assets).

## Mood

Calm, serene, breathable. The customer should feel ready to _slow
down_. The photo carries no urgency, no action, no crowd.

## Composition

- **Single figure** — no group shots
- **Soft pose** — sitting in lotus, standing in mountain, gentle
  forward fold, restorative supine. No mid-action jumps or twists.
- **Face / upper-torso safe crop** — model's face stays in the upper
  third of the frame (object-position `50% 35%` in our render system)
- **Negative space** — roughly 30–40 % of the frame stays uncluttered
  so type can lie over it later
- **Vertical orientation** preferred (we crop to 3:4 / 4:5)

## Lighting

- **Natural light**, soft diffused — morning hour or late afternoon
- Avoid harsh shadows; max contrast ratio about 7:1
- **Cool colour temp** (4500–5500 K) — supports the brand teal tint
  applied at render time
- No on-camera flash, no studio strobes feeling

## Fabric & texture

- Smooth, matte fabrics (jersey, modal, ribbed cotton). Avoid shiny
  performance synthetics — those belong in Sport.
- Solid colours preferred — **teal, sage, cream, blush, ivory**
- Minimal pattern; if any, a single subtle stripe or earth tone
- Skin tone treatment: warm but de-saturated. No heavy beauty
  retouching.

## Avoid

- Action poses (running, jumping, lifting) — that's Sport
- Multiple subjects in the frame — that's Casual / Lifestyle
- Saturated backgrounds (neon, party light) — that's Dance
- Bright primary colours (red, electric blue) — out of Yoga palette
- AI-generated backgrounds or composites — cheapens the premium brand

## Curation workflow (existing photos)

When pulling shots from an existing shoot:

1. Open in **Lightroom** → apply the MindBody base preset
   (cool +5 white balance, +5 shadow lift, -10 saturation on
   highlights, -5 contrast)
2. Pick shots that match the _Composition_ and _Lighting_ notes above
3. Crop to 3:4 vertical with the model's face on the upper-third grid
   intersection (Lightroom's overlay grid helps)
4. Export at 3200 px wide JPEG (q=92) → drop into `/public/pics*` →
   the variant generator emits AVIF / WebP / LQIP automatically

For **fixes** that need pixel work (background tidy, fabric crease,
distracting object removal):

- Use **Photoshop Generative Fill** — select the distraction, prompt
  "match background, soft light"
- For extending edges to reach 3:4 ratio: **Generative Expand**

## Reference brands (style baseline)

- **Sézane** — _Yoga capsule_ collection look book
- **Cuyana** — _Slow Living_ lifestyle stories
- **Aesop** — bath / self-care editorial photography
- **Bonpoint** — quiet luxury family shoots (for Yoga × Kids overlap)
- **The Row** — restrained model direction, minimal hands

Pin two or three shots from each as a moodboard before shooting a new
batch. The reference is the floor, not the ceiling — the goal is
_MindBody Yoga_ not _Sézane Yoga_.

## Render treatment (what the site applies on top)

Once a Yoga-tagged category card renders on the site, the engine adds:

- **Tint overlay**: `rgba(74, 138, 138, 0.10)` (10 % brand teal)
- **Title weight**: Cormorant Garamond 400 (light)
- **Title letter-spacing**: `0.18em` (airy)

If the photo is too dark or too contrasty, the tint sits unevenly.
Pick shots with a balanced histogram — that's why the Lightroom preset
above pulls highlights down before export.
