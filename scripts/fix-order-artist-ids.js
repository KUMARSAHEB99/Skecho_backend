import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrderArtistIds() {
  try {
    console.log('Checking orders for incorrect artistId values...');
    
    // Get all orders
    const orders = await prisma.order.findMany({
      include: {
        artist: true,
        product: {
          include: {
            seller: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    console.log(`Found ${orders.length} total orders`);

    for (const order of orders) {
      console.log(`\nOrder ID: ${order.id}`);
      console.log(`Type: ${order.type}`);
      console.log(`Artist ID: ${order.artistId}`);
      console.log(`Artist found: ${order.artist ? 'Yes' : 'No'}`);
      
      if (order.artist) {
        console.log(`Artist name: ${order.artist.name}`);
      }

      if (order.type === 'product' && order.product) {
        console.log(`Product seller user ID: ${order.product.seller.user.id}`);
        console.log(`Product seller name: ${order.product.seller.user.name}`);
        
        // Check if artistId matches the seller's user ID
        if (order.artistId !== order.product.seller.user.id) {
          console.log('❌ MISMATCH: artistId does not match seller user ID');
          console.log(`Current artistId: ${order.artistId}`);
          console.log(`Should be: ${order.product.seller.user.id}`);
          
          // Fix the artistId
          await prisma.order.update({
            where: { id: order.id },
            data: { artistId: order.product.seller.user.id }
          });
          console.log('✅ Fixed artistId');
        } else {
          console.log('✅ artistId matches seller user ID');
        }
      }
    }

    console.log('\n✅ Order artistId check complete!');
  } catch (error) {
    console.error('Error fixing order artist IDs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrderArtistIds(); 