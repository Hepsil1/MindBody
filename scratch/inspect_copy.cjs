const fs = require('fs');

function inspectCopy() {
  const home = fs.readFileSync('app/routes/home.tsx', 'utf8');
  console.log('=== SECTIONS IN HOME.TSX ===');
  const sectionMatches = home.match(/<section[\s\S]*?<\/section>/g) || [];
  console.log('Total sections:', sectionMatches.length);
  
  // Look for text in features, values, about
  const lines = home.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('feature-item') || line.includes('values-') || line.includes('bw-') || line.includes('hero') || line.includes('ig-hyper')) {
      console.log(`Line ${idx+1}: ${line.trim()}`);
    }
  });
}

inspectCopy();
