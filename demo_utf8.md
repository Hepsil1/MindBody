## Design System: MindBody

### Pattern
- **Name:** Feature-Rich Showcase
- **CTA Placement:** Above fold
- **Sections:** Hero > Features > CTA

### Style
- **Name:** Liquid Glass
- **Keywords:** Flowing glass, morphing, smooth transitions, fluid effects, translucent, animated blur, iridescent, chromatic aberration
- **Best For:** Premium SaaS, high-end e-commerce, creative platforms, branding experiences, luxury portfolios
- **Performance:** ΓÜá Moderate-Poor | **Accessibility:** ΓÜá Text contrast

### Colors
| Role | Hex |
|------|-----|
| Primary | #2563EB |
| Secondary | #3B82F6 |
| CTA | #F97316 |
| Background | #F8FAFC |
| Text | #1E293B |

*Notes: Premium dark + gold accent [Accent adjusted from #CA8A04 for WCAG 3:1]*

### Typography
- **Heading:** Barlow Condensed
- **Body:** Barlow
- **Mood:** sports, fitness, athletic, energetic, condensed, action
- **Best For:** Sports, fitness, gyms, athletic brands, competition
- **Google Fonts:** https://fonts.google.com/share?selection.family=Barlow+Condensed:wght@400;500;600;700|Barlow:wght@300;400;500;600;700
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Morphing elements (SVG/CSS), fluid animations (400-600ms curves), dynamic blur (backdrop-filter), color transitions

### Avoid (Anti-patterns)
- Vibrant & Block-based
- Playful colors

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px

