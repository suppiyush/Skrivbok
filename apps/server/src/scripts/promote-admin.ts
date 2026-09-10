/**
 * Promote an account to ADMIN.
 *
 * There is deliberately no API route that grants admin: the first admin has to
 * be made out-of-band, or the privilege boundary is only as strong as the
 * weakest endpoint that can reach it.
 *
 *   npx dotenv -e ../../.env -- npx tsx src/scripts/promote-admin.ts you@example.com
 */
import { prisma } from '../db/prisma.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: promote-admin.ts <email>');
  process.exit(1);
}

const user = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
console.log(`${user.email} is now ${user.role}`);
await prisma.$disconnect();
