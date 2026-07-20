const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret-portoparques-super-secure-key';

function verifyToken(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  
  if (typeof bearerHeader !== 'undefined') {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];
    
    jwt.verify(bearerToken, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
      }
      // decoded contains { id, username, rol, iat, exp }
      req.user = decoded;
      next();
    });
  } else {
    res.status(403).json({ message: 'No se proporcionó un token de acceso' });
  }
}

// Middleware para validar roles específicos
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No tienes los permisos necesarios para realizar esta acción' });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
  JWT_SECRET
};
