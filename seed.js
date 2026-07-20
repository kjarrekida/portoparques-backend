const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.usuario.findUnique({
    where: { username: 'admin' }
  });

  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.usuario.create({
      data: {
        username: 'admin',
        passwordHash,
        rol: 'ADMIN',
        estado: 'Activo'
      }
    });
    console.log('Usuario Super Administrador (admin/admin123) creado exitosamente.');
  } else {
    console.log('El usuario admin ya existe.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
