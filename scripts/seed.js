#!/usr/bin/env node
// Seed (or re-seed) the HRMate database with realistic demo data.
import { DATA_DIR } from '../server/lib/db.js';
import { seedDatabase } from '../server/seed.js';

const force = process.argv.includes('--force');
const started = Date.now();
const result = seedDatabase({ force });
const ms = Date.now() - started;

if (result.skipped) {
  console.log(`✔ Database already seeded (company #${result.companyId}). Run \`npm run reset\` to rebuild.`);
} else {
  console.log(`✔ Seeded in ${ms}ms → ${DATA_DIR}/hrmate.db`);
  console.table(result.stats);
}
console.log('\nDemo logins (password: Demo@1234, PIN: 123456)');
console.log('  aarav.mehta@northpeak.io   → Super Admin');
console.log('  priya.nair@northpeak.io    → HR Admin');
console.log('  rohan.deshmukh@northpeak.io→ HR Manager');
console.log('  ananya.sharma@northpeak.io → Department Manager');
console.log('  vikram.rao@northpeak.io    → Supervisor');
console.log('  meera.iyer@northpeak.io    → Team Leader');
console.log('  kabir.malhotra@northpeak.io→ Employee');
