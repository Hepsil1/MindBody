const fs = require('fs');
const path = require('path');

/**
 * PM2 does NOT support `env_file` — it silently ignores it.
 * This function reads .env manually and injects vars into PM2's env block.
 */
function loadEnvFile(envPath) {
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const envVars = loadEnvFile(path.join(__dirname, '.env'));

module.exports = {
  apps: [
    {
      name: "mindbody",
      script: "node_modules/@react-router/serve/dist/cli.js",
      args: "./build/server/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        ...envVars
      }
    }
  ]
};
