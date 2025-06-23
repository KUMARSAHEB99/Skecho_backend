import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting address migration script...');

  const users = await prisma.user.findMany({
    include: {
      addresses: {
        orderBy: {
          createdAt: 'desc', // Get the most recent address first
        },
      },
    },
  });

  for (const user of users) {
    if (user.addresses.length > 1) {
      console.log(`User ${user.id} (${user.email}) has ${user.addresses.length} addresses. Cleaning up...`);

      const addressesToDelete = user.addresses.slice(1);
      const addressIdsToDelete = addressesToDelete.map(addr => addr.id);

      if (addressIdsToDelete.length > 0) {
        console.log(`  Deleting ${addressIdsToDelete.length} address(es).`);
        await prisma.address.deleteMany({
          where: {
            id: {
              in: addressIdsToDelete,
            },
          },
        });
        console.log(`  Cleanup complete for user ${user.id}.`);
      }
    }
  }

  console.log('Address migration script finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 