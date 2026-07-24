const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { username: 'admin', password: '123', rol: 'ADMIN' },
    { username: 'jefe', password: '123', rol: 'JEFE_TECNICO' },
    { username: 'tecnico', password: '123', rol: 'TECNICO' }
  ];

  for (const user of roles) {
    const exists = await prisma.usuario.findUnique({ where: { username: user.username } });
    if (!exists) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await prisma.usuario.create({
        data: {
          username: user.username,
          passwordHash,
          rol: user.rol,
          estado: 'Activo'
        }
      });
      console.log(`Usuario ${user.rol} (${user.username}/${user.password}) creado.`);
    } else {
      console.log(`El usuario ${user.username} ya existe.`);
    }
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
