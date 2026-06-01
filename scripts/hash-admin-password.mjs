// Generate a bcrypt hash for the admin password.
//
//   node scripts/hash-admin-password.mjs "your-password"
//
// Copy the printed ADMIN_PASSWORD_HASH line into .env, then remove the plaintext
// ADMIN_PASSWORD. verifyAdminPassword() prefers the hash when present.
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
    console.error('Usage: node scripts/hash-admin-password.mjs "<password>"');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("\nAdd this to your .env (then you can delete ADMIN_PASSWORD):\n");
console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
