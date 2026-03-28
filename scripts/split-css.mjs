import fs from 'fs';
import postcss from 'postcss';
import path from 'path';

const APP_CSS = 'app/app.css';

const MAPPINGS = {
  'home.css': [
    '.hero-slider', '.about-modern', '.collections-badge',
    '.editorial-categories-grid', '.feature-item', '.features-bar__grid',
    '.instagram-section', '.premium-features-bar', '.value-item', '.values-modern',
    '.category-pill', '.home-hero'
  ],
  'shop.css': [
    '.shop-', '.mb-shop', '.luxe-', '.sort-chips', '.mb-checkbox',
    '.mb-color', '.mb-size', '.mb-reset-filters', '.mb-toolbar',
    '.accordion-', '.shop-hero', '.shop-filter', '.mb-'
  ],
  'checkout.css': [
    '.checkout', '.mb-checkout', '.checkout-form', '.checkout-sidebar'
  ],
  'contacts.css': [
    '.contact-', '.contacts-'
  ],
  'cart.css': [
    '.cart-drawer'
  ],
  'wishlist.css': [
    '.wishlist-page', '.wishlist-hero', '.wishlist-empty'
  ]
};

const extractedCSS = Object.fromEntries(Object.keys(MAPPINGS).map(key => [key, postcss.root()]));

// Check if a rule contains any of the target prefixes
function matchesPrefixes(rule, prefixes) {
  if (rule.type !== 'rule') return false;
  return rule.selectors.some(selector => 
    prefixes.some(prefix => selector.includes(prefix))
  );
}

const plugin = () => {
  return {
    postcssPlugin: 'extract-css',
    Once(root) {
      root.walkRules(rule => {
        let targetFile = null;

        for (const [file, prefixes] of Object.entries(MAPPINGS)) {
          if (matchesPrefixes(rule, prefixes)) {
            // Check for more specific .mb- rules
            if (prefixes.includes('.mb-')) {
              if (!rule.selectors.some(s => /\.(mb-shop|mb-checkbox|mb-size|mb-color|mb-reset|mb-toolbar|mb-checkout)/.test(s))) {
                continue;
              }
            }
            targetFile = file;
            break;
          }
        }

        if (targetFile) {
          if (rule.parent && rule.parent.type === 'atrule') {
            const atRuleName = rule.parent.name;
            const atRuleParams = rule.parent.params;
            
            let existingAtRule = extractedCSS[targetFile].nodes.find(
              n => n.type === 'atrule' && n.name === atRuleName && n.params === atRuleParams
            );

            if (!existingAtRule) {
               existingAtRule = postcss.atRule({ name: atRuleName, params: atRuleParams });
               extractedCSS[targetFile].append(existingAtRule);
            }
            existingAtRule.append(rule.clone());
          } else {
            extractedCSS[targetFile].append(rule.clone());
          }
          
          const parent = rule.parent;
          rule.remove();

          if (parent && parent.type === 'atrule' && parent.nodes.length === 0) {
             parent.remove();
          }
        }
      });
    }
  };
};
plugin.postcss = true;

async function run() {
  const css = fs.readFileSync(APP_CSS, 'utf8');
  
  const result = await postcss([plugin()]).process(css, { from: APP_CSS, to: APP_CSS });
  
  // Write the modified app.css
  fs.writeFileSync(APP_CSS, result.css);
  console.log('Updated app.css (size reduced by extracted parts).');

  // Write new files
  for (const [file, root] of Object.entries(extractedCSS)) {
    if (root.nodes.length > 0) {
      const outputPath = path.join('app', 'styles', file);
      fs.writeFileSync(outputPath, root.toString());
      console.log(`Created ${outputPath}`);
    }
  }
}

run().catch(err => console.error(err));
