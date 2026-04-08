import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUser(email: string, role: any, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${role} already exists. Login: ${email} / password`);
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password', salt);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
    },
  });

  console.log(`${role} created successfully. Login: ${email} / password`);
}

async function main() {
  await createUser('host@example.com', 'HOST', 'Test Host');
  await createUser('guest@example.com', 'GUEST', 'Test Guest');
  await createUser('admin@example.com', 'ADMIN', 'System Admin');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
