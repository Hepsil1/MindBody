const fs = require('fs');
const lines = fs.readFileSync('app/routes/p.$slug.tsx', 'utf8').split('\n');
console.log(lines.slice(1450, 1530).join('\n'));
