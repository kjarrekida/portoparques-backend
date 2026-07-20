require('dotenv').config();

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgt_RZbbEnAE8h8sO_IZJG9CavwF476hp9OQsivEvoBiyZvxbLqqe6VQeEW_4tOe1k/exec';
const CORREO_INSTITUCIONAL = 'info@portoparques.gob.ec';

async function sendEmailViaGAS({ to, subject, html, replyTo }) {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ to, subject, html, replyTo })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Error desconocido en Google Apps Script');
    }
    return data;
  } catch (error) {
    console.error('Error en sendEmailViaGAS:', error);
    throw error;
  }
}

function obtenerNotaServicio(tipoServicio) {
  if (tipoServicio === 'Poda Pública' || tipoServicio === 'Poda Publica') {
    return 'Su solicitud será atendida en un plazo máximo de quince (15) días término, contados a partir de la fecha de emisión de este comprobante. Para consultas sobre el estado de su trámite, comuníquese con nosotros indicando su código de trámite.';
  } else if (tipoServicio === 'Poda Privada') {
    return 'Un representante de Portoparques EP se comunicará con usted en la brevedad para coordinar la inspección y los detalles del servicio.';
  } else if (tipoServicio === 'Tala Pública' || tipoServicio === 'Tala Publica') {
    return 'Su solicitud será revisada junto con la resolución ambiental adjunta. El servicio de tala se gestionará en un plazo máximo de quince (15) días término, contados a partir de la fecha de emisión.';
  } else if (tipoServicio === 'Tala Privada') {
    return 'Su solicitud será revisada junto con la resolución ambiental adjunta. Un representante de Portoparques EP se comunicará con usted en la brevedad para coordinar los detalles del servicio.';
  }
  return '';
}

async function enviarCorreoCiudadano(datos) {
  const notaAdicional = obtenerNotaServicio(datos.tipoServicio);
  
  const htmlTemplate = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #2e7d32; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Confirmacion de Solicitud</h1>
      <p style="color: #e8f5e9; margin: 5px 0 0 0; font-size: 16px;">Portoparques EP</p>
    </div>
    
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333;">Estimado/a <strong>${datos.nombreApellidos}</strong>,</p>
      
      <p style="font-size: 15px; color: #555; line-height: 1.5;">Hemos recibido exitosamente su solicitud de servicio a traves de nuestro portal web. A continuacion, le presentamos los detalles de su requerimiento:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; width: 40%; color: #666;"><strong>Codigo de tramite:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; color: #2e7d32; font-weight: bold;">${datos.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; color: #666;"><strong>Tipo de Servicio:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; color: #333;">${datos.tipoServicio}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; color: #666;"><strong>Numero de Arboles:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; color: #333;">${datos.numeroArboles}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Fecha de ingreso:</strong></td>
            <td style="padding: 8px 0; color: #333;">${new Date().toLocaleDateString('es-EC')}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #2e7d32;">NOTA:</h4>
        <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">
          ${notaAdicional}
        </p>
      </div>
      
      <p style="font-size: 14px; color: #777; margin-top: 30px; text-align: center;">
        Este es un mensaje automatico, por favor no responda a este correo.
      </p>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
      &copy; ${new Date().getFullYear()} Portoparques EP. Todos los derechos reservados.<br>
      Portoviejo, Ecuador
    </div>
  </div>
  `;

  try {
    await sendEmailViaGAS({
      replyTo: CORREO_INSTITUCIONAL,
      to: datos.correo,
      subject: `Confirmacion de Trámite - ${datos.id}`,
      html: htmlTemplate,
    });
    console.log('Correo a ciudadano enviado por GAS');
  } catch (error) {
    console.error('Error enviando correo al ciudadano:', error);
  }
}

async function enviarCorreoInstitucional(datos) {
  const urlResolucionStr = datos.resolucionPdf ? `<a href="http://localhost:4000/${datos.resolucionPdf}" style="color: #1976d2;">Ver PDF</a>` : 'N/A';
  const urlFotoStr = datos.fotoAntes ? `<a href="http://localhost:4000/${datos.fotoAntes}" style="color: #1976d2;">Ver Foto</a>` : 'N/A';

  const htmlTemplate = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #1976d2; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">NUEVA SOLICITUD WEB</h1>
    </div>
    <div style="padding: 20px;">
      <p>Se ha registrado una nueva solicitud desde la pagina web.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; width: 35%;"><strong>Tramite ID</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>${datos.id}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Tipo de Servicio</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.tipoServicio}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Ciudadano</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.nombreApellidos}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Cedula</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.cedula}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Contacto</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.telefono} / ${datos.correo}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Parroquia</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.parroquia}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Direccion</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.direccion}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Numero de Arboles</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.numeroArboles}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Comentario</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${datos.comentario}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Foto</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${urlFotoStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Resolucion Ambiental</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${urlResolucionStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Ubicacion</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;"><a href="${datos.ubicacionMaps}">Ver en Google Maps</a></td>
        </tr>
      </table>
    </div>
  </div>
  `;

  try {
    await sendEmailViaGAS({
      to: CORREO_INSTITUCIONAL,
      subject: `Nueva Solicitud de ${datos.tipoServicio} - ${datos.id}`,
      html: htmlTemplate,
    });
    console.log('Correo institucional enviado por GAS');
  } catch (error) {
    console.error('Error enviando correo institucional:', error);
  }
}

async function enviarCorreoRutaDiaria(solicitudesDelDia, correoJefe) {
  if (!solicitudesDelDia || solicitudesDelDia.length === 0) return;

  const filasTabla = solicitudesDelDia.map(s => `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.id}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.tipoServicio}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.parroquia}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.direccion}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${s.numeroArboles}</td>
      <td style="padding: 10px; border: 1px solid #ddd;"><a href="${s.ubicacionMaps}" target="_blank" style="color: #2e7d32; text-decoration: none;">Ver Mapa</a></td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="background-color: #2e7d32; padding: 25px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">Portoparques EP</h2>
        <p style="color: #c8e6c9; margin: 5px 0 0; font-size: 14px;">Planificación de Ruta Diaria</p>
      </div>
      
      <div style="padding: 30px; background-color: #ffffff;">
        <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
          Estimado Equipo Técnico,<br><br>
          A continuación, se detalla la ruta de trabajo planificada para el día de hoy. Por favor, atienda las siguientes solicitudes en el orden que considere más óptimo:
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
          <thead style="background-color: #f1f8e9;">
            <tr>
              <th style="padding: 12px 10px; border: 1px solid #ddd; text-align: left; color: #2e7d32;">Código</th>
              <th style="padding: 12px 10px; border: 1px solid #ddd; text-align: left; color: #2e7d32;">Servicio</th>
              <th style="padding: 12px 10px; border: 1px solid #ddd; text-align: left; color: #2e7d32;">Parroquia</th>
              <th style="padding: 12px 10px; border: 1px solid #ddd; text-align: left; color: #2e7d32;">Dirección</th>
              <th style="padding: 12px 10px; border: 1px solid #ddd; text-align: center; color: #2e7d32;">Árboles</th>
              <th style="padding: 12px 10px; border: 1px solid #ddd; text-align: left; color: #2e7d32;">Ubicación</th>
            </tr>
          </thead>
          <tbody>
            ${filasTabla}
          </tbody>
        </table>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #fff8e1; border-left: 4px solid #ffb300; border-radius: 4px;">
          <p style="margin: 0; color: #f57c00; font-size: 14px; font-weight: bold;">RECORDATORIO IMPORTANTE</p>
          <p style="margin: 5px 0 0; color: #555; font-size: 13px;">
            Asegúrese de tomar fotografías de evidencia una vez finalizado el trabajo en cada punto, para poder cambiar el estado a "Atendido" en el sistema.
          </p>
        </div>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0;">Este es un correo generado automáticamente. Por favor, no responda a este mensaje.</p>
        <p style="margin: 5px 0 0;">&copy; ${new Date().getFullYear()} Portoparques EP. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  try {
    await sendEmailViaGAS({
      to: correoJefe,
      subject: `Ruta de Trabajo Diaria - ${new Date().toLocaleDateString('es-EC')}`,
      html: html
    });
    console.log(`Correo de ruta diaria enviado por GAS exitosamente a ${correoJefe} con ${solicitudesDelDia.length} puntos.`);
  } catch (error) {
    console.error('Error enviando correo de ruta diaria:', error);
  }
}

async function enviarCorreoActualizacionEstado(datos) {
  if (!datos.correo) return;

  const htmlTemplate = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #2e7d32; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Actualización de Estado</h1>
      <p style="color: #e8f5e9; margin: 5px 0 0 0; font-size: 16px;">Portoparques EP</p>
    </div>
    
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333;">Estimado/a <strong>${datos.nombreApellidos}</strong>,</p>
      
      <p style="font-size: 15px; color: #555; line-height: 1.5;">Le informamos que el estado de su trámite <strong>${datos.id}</strong> ha sido actualizado.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h2 style="margin: 0; text-align: center; color: #2e7d32; font-size: 22px;">NUEVO ESTADO: ${datos.estado}</h2>
        ${datos.estado === 'Planificado' && datos.fechaPlanificada ? `<p style="text-align: center; color: #555; font-weight: bold;">Fecha Programada: ${new Date(datos.fechaPlanificada).toLocaleDateString('es-EC')}</p>` : ''}
        ${datos.estado === 'Atendido' ? `<p style="text-align: center; color: #4caf50; font-weight: bold;">¡El servicio ha sido completado!</p>` : ''}
        ${datos.estado === 'Cancelado' ? `<p style="text-align: center; color: #f44336; font-weight: bold;">Motivo: ${datos.motivoCancelacion}</p>` : ''}
      </div>

      <p style="font-size: 14px; color: #777; margin-top: 30px; text-align: center;">
        Puede consultar todos los detalles en nuestro portal de rastreo público.
      </p>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
      &copy; ${new Date().getFullYear()} Portoparques EP. Todos los derechos reservados.
    </div>
  </div>
  `;

  try {
    await sendEmailViaGAS({
      replyTo: CORREO_INSTITUCIONAL,
      to: datos.correo,
      subject: `Actualización de su trámite ${datos.id} - ${datos.estado}`,
      html: htmlTemplate,
    });
    console.log('Correo de actualización de estado enviado por GAS a:', datos.correo);
  } catch (error) {
    console.error('Error enviando correo de estado:', error);
  }
}

module.exports = {
  enviarCorreoCiudadano,
  enviarCorreoInstitucional,
  enviarCorreoRutaDiaria,
  enviarCorreoActualizacionEstado
};
