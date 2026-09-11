/** List every account and its role. Read-only; for finding who to promote. */
import { prisma } from '../db/prisma.js';

const users = await prisma.user.findMany({
  select: { email: true, role: true, createdAt: true },
  orderBy: { createdAt: 'asc' },
});
console.log(`${users.length} account(s)`);
for (const u of users) console.log(`${u.role.padEnd(6)} ${u.email}`);
await prisma.$disconnect();
