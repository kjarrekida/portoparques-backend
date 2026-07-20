const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    await prisma.solicitud.updateMany({
        where: { estado: '' },
        data: { estado: 'Planificado' }
    });
    console.log("Fixed!");
}
fix();
