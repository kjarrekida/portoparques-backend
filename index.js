require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const { enviarCorreoCiudadano, enviarCorreoInstitucional, enviarCorreoRutaDiaria, enviarCorreoActualizacionEstado } = require('./mailer');
const { verifyToken, requireRole, JWT_SECRET } = require('./auth');

const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(express.json());
// Servir la carpeta uploads estáticamente para ver los archivos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de Multer para subir archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Rate Limiter: Máximo 5 solicitudes por IP cada 15 minutos para el endpoint público
const solicitudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { status: 'error', message: 'Demasiadas solicitudes desde esta IP. Intente nuevamente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generador de ID
async function generarNuevoId() {
  const currentYear = new Date().getFullYear();
  // Buscar la última solicitud del año
  const lastSolicitud = await prisma.solicitud.findFirst({
    where: {
      id: {
        startsWith: `PP-PODA-${currentYear}`
      }
    },
    orderBy: {
      id: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastSolicitud) {
    // PP-PODA-2025-000001 -> split '-' -> ['PP','PODA','2025','000001']
    const parts = lastSolicitud.id.split('-');
    const lastNumberStr = parts[3];
    nextNumber = parseInt(lastNumberStr, 10) + 1;
  }

  const paddedNumber = nextNumber.toString().padStart(6, '0');
  return `PP-PODA-${currentYear}-${paddedNumber}`;
}

// Middleware para verificar Cloudflare Turnstile
const verifyTurnstile = async (req, res, next) => {
  const turnstileToken = req.body.turnstileToken;
  if (!turnstileToken) {
    return res.status(400).json({ status: 'error', message: 'Falta validación de seguridad (Captcha).' });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', '0x4AAAAAAD837L_QrjnRhq1SQRAxdLR04w4');
    formData.append('response', turnstileToken);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.success) {
      next();
    } else {
      res.status(400).json({ status: 'error', message: 'Verificación de seguridad fallida. Sesión expirada o bot detectado.' });
    }
  } catch (error) {
    console.error('Turnstile verification error:', error);
    res.status(500).json({ status: 'error', message: 'Error de verificación de seguridad.' });
  }
};

// Endpoint para crear solicitud
// Acepta multipart/form-data con los campos fotoAntes y resolucion
app.post('/api/solicitudes', solicitudLimiter, upload.fields([{ name: 'fotoAntes', maxCount: 1 }, { name: 'resolucion', maxCount: 1 }]), verifyTurnstile, async (req, res) => {
  try {
    const data = req.body;
    
    // Obtener rutas de archivos subidos si existen
    const fotoAntesPath = req.files && req.files['fotoAntes'] 
      ? `uploads/${req.files['fotoAntes'][0].filename}` 
      : null;
      
    const resolucionPdfPath = req.files && req.files['resolucion'] 
      ? `uploads/${req.files['resolucion'][0].filename}` 
      : null;

    // Validar tipo de servicio y campos requeridos
    if (!data.tipoServicio || !data.nombreApellidos || !data.cedula) {
      return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
    }

    const nuevoId = await generarNuevoId();

    // Crear registro en base de datos
    const nuevaSolicitud = await prisma.solicitud.create({
      data: {
        id: nuevoId,
        tipoServicio: data.tipoServicio,
        nombreApellidos: data.nombreApellidos,
        direccion: data.direccion || '',
        ubicacionMaps: data.ubicacionMaps || '',
        parroquia: data.parroquia || '',
        cedula: data.cedula,
        telefono: data.telefono || '',
        correo: data.correo || '',
        numeroArboles: parseInt(data.numeroArboles) || 1,
        comentario: data.comentario || '',
        fotoAntes: fotoAntesPath,
        resolucionPdf: resolucionPdfPath,
        estado: 'Nuevo',
      }
    });

    // Enviar correos en segundo plano (no hacer await para no bloquear la respuesta)
    enviarCorreoCiudadano(nuevaSolicitud).catch(e => console.error(e));
    enviarCorreoInstitucional(nuevaSolicitud).catch(e => console.error(e));

    res.status(200).json({
      status: 'success',
      idTramite: nuevoId,
      message: 'Solicitud guardada con éxito'
    });

  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

// Endpoint para consultar el estado de una solicitud (Público)
app.get('/api/solicitudes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const solicitud = await prisma.solicitud.findUnique({
      where: { id: id.toUpperCase() },
      select: {
        id: true,
        tipoServicio: true,
        fecha: true,
        nombreApellidos: true,
        estado: true,
        fechaAtencion: true,
        motivoCancelacion: true,
      }
    });

    if (!solicitud) {
      return res.status(404).json({ status: 'error', message: 'Trámite no encontrado' });
    }

    res.status(200).json({ status: 'success', data: solicitud });
  } catch (error) {
    console.error('Error al consultar solicitud:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

// Endpoint Público para Rastreo de Trámites por ID o Cédula
app.get('/api/rastreo/:busqueda', async (req, res) => {
  try {
    const busqueda = req.params.busqueda.trim();
    const solicitudes = await prisma.solicitud.findMany({
      where: {
        OR: [
          { id: busqueda.toUpperCase() },
          { cedula: busqueda }
        ]
      },
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        tipoServicio: true,
        fecha: true,
        nombreApellidos: true,
        estado: true,
        fechaPlanificada: true,
        fechaAtencion: true,
        motivoCancelacion: true,
      }
    });

    if (solicitudes.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No se encontraron trámites.' });
    }

    res.status(200).json({ status: 'success', data: solicitudes });
  } catch (error) {
    console.error('Error al rastrear:', error);
    res.status(500).json({ status: 'error', message: 'Error interno' });
  }
});

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Faltan credenciales' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { username }
    });

    if (!usuario || usuario.estado !== 'Activo') {
      return res.status(401).json({ message: 'Credenciales inválidas o usuario inactivo' });
    }

    const isMatch = await bcrypt.compare(password, usuario.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, usuario: { id: usuario.id, username: usuario.username, rol: usuario.rol } });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS DE ADMINISTRACIÓN (PROTEGIDAS)
// ==========================================

// Endpoint para validar el token actual
app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ usuario: req.user });
});

// Endpoint para obtener todos los usuarios (Solo ADMIN)
app.get('/api/admin/usuarios', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, username: true, rol: true, estado: true, createdAt: true }
    });
    res.json({ status: 'success', data: usuarios });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al obtener usuarios' });
  }
});

// Endpoint para crear un usuario (Solo ADMIN)
app.post('/api/admin/usuarios', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { username, password, rol } = req.body;
    const exists = await prisma.usuario.findUnique({ where: { username } });
    if (exists) return res.status(400).json({ status: 'error', message: 'El usuario ya existe' });

    const passwordHash = await bcrypt.hash(password, 10);
    const nuevo = await prisma.usuario.create({
      data: { username, passwordHash, rol: rol || 'TECNICO' },
      select: { id: true, username: true, rol: true, estado: true }
    });
    res.json({ status: 'success', data: nuevo });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al crear usuario' });
  }
});

// Endpoint para actualizar un usuario (Solo ADMIN)
app.put('/api/admin/usuarios/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { password, rol, estado } = req.body;
    let dataToUpdate = {};
    if (password) dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    if (rol) dataToUpdate.rol = rol;
    if (estado) dataToUpdate.estado = estado;

    const updated = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, username: true, rol: true, estado: true }
    });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al actualizar usuario' });
  }
});

// Obtener todas las solicitudes para el Dashboard (añadiendo fechaPlanificada al select)
app.get('/api/admin/solicitudes', verifyToken, async (req, res) => {
  try {
    const solicitudes = await prisma.solicitud.findMany({
      orderBy: { fecha: 'desc' }
    });
    res.status(200).json({ status: 'success', data: solicitudes });
  } catch (error) {
    console.error('Error al obtener lista de solicitudes:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

// Planificar una solicitud para una fecha específica (Solo Jefe Tecnico o Admin)
app.put('/api/admin/solicitudes/:id/planificar', verifyToken, requireRole(['ADMIN', 'JEFE_TECNICO']), async (req, res) => {
  try {
    const { id } = req.params;
    const { fechaPlanificada } = req.body;
    
    if (!fechaPlanificada) {
      return res.status(400).json({ status: 'error', message: 'Falta la fecha planificada' });
    }

    const updatedSolicitud = await prisma.solicitud.update({
      where: { id: id.toUpperCase() },
      data: { 
        // Agregamos T12:00:00 para asegurar que la fecha no retroceda un día por la zona horaria UTC
        fechaPlanificada: new Date(`${fechaPlanificada}T12:00:00`),
        estado: 'Planificado'
      }
    });

    // Enviar notificación al ciudadano en segundo plano
    enviarCorreoActualizacionEstado(updatedSolicitud).catch(e => console.error(e));

    res.status(200).json({ status: 'success', data: updatedSolicitud });
  } catch (error) {
    console.error('Error al planificar solicitud:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

// Actualizar estado de una solicitud (Solo Jefe Tecnico o Admin)
app.put('/api/admin/solicitudes/:id', verifyToken, requireRole(['ADMIN', 'JEFE_TECNICO']), upload.single('fotoDespues'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivoCancelacion } = req.body;
    
    let dataToUpdate = {
      estado: estado
    };

    if (estado === 'Atendido') {
      dataToUpdate.fechaAtencion = new Date();
    } else if (estado === 'Cancelado') {
      dataToUpdate.motivoCancelacion = motivoCancelacion || 'Cancelado por administración';
    }

    if (req.file) {
      dataToUpdate.fotoDespues = `uploads/${req.file.filename}`;
    }

    const updatedSolicitud = await prisma.solicitud.update({
      where: { id: id.toUpperCase() },
      data: dataToUpdate
    });

    // Enviar notificación al ciudadano en segundo plano
    enviarCorreoActualizacionEstado(updatedSolicitud).catch(e => console.error(e));

    res.status(200).json({ status: 'success', data: updatedSolicitud });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar el registro' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

// ==========================================
// TAREAS AUTOMÁTICAS (CRON JOBS)
// ==========================================

// Ejecutar todos los días a las 06:45 AM (Hora de servidor)
// Ejecutar todos los días a las 06:45 AM (Hora de servidor)
// "45 6 * * *"
cron.schedule('45 6 * * *', async () => {
  console.log('Cron Job: Verificando solicitudes planificadas para hoy a las 06:45 AM');
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const solicitudesDelDia = await prisma.solicitud.findMany({
      where: {
        estado: 'Planificado', // Las que ya tienen fecha asignada para hoy
        fechaPlanificada: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        parroquia: 'asc' // Agruparlas lógicamente por parroquia para facilitar la ruta
      }
    });

    if (solicitudesDelDia.length > 0) {
      console.log(`Cron Job: Se encontraron ${solicitudesDelDia.length} solicitudes para hoy.`);
      // Enviar al correo de desarrollo según lo solicitado por el usuario
      const correoDestino = process.env.CORREO_JEFE_TECNICO || 'kevin.jarre@portoparques.gob.ec';
      await enviarCorreoRutaDiaria(solicitudesDelDia, correoDestino);
    } else {
      console.log('Cron Job: No hay solicitudes planificadas para el día de hoy.');
    }
  } catch (error) {
    console.error('Error en Cron Job de ruta diaria:', error);
  }
});
