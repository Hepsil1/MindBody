import fs from 'fs';

function addImport(file, cssFile) {
  let content = fs.readFileSync(file, 'utf8');
  const importStatement = `import styles from "../styles/${cssFile}?url";\n`;
  if (content.includes(`styles/${cssFile}`)) {
    console.log(`Already has ${cssFile} in ${file}`);
    return;
  }
  
  // Find where to insert the import
  const lines = content.split('\n');
  const lastImportIndex = lines.findLastIndex(l => l.startsWith('import '));
  lines.splice(lastImportIndex + 1, 0, importStatement);
  
  content = lines.join('\n');
  
  if (content.includes('export function links() {')) {
    content = content.replace(
      /export function links\(\) \{\n\s*return \[\n?((?:\s*\{[^}]*\},?\n?)*)\s*\];?/g,
      `export function links() {\n  return [\n$1    { rel: "stylesheet", href: styles },\n  ];`
    );
  } else {
    content += `\nexport function links() {\n  return [{ rel: "stylesheet", href: styles }];\n}\n`;
  }
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}

addImport('app/routes/home.tsx', 'home.css');
addImport('app/routes/shop.$category.tsx', 'shop.css');
addImport('app/routes/checkout.tsx', 'checkout.css');
addImport('app/routes/contacts.tsx', 'contacts.css');
addImport('app/routes/wishlist.tsx', 'wishlist.css');
