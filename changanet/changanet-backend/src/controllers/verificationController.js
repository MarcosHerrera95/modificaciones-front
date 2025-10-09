// src/controllers/verificationController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.submitVerification = async (req, res) => {
  const { id: userId } = req.user;
  const { url_documento } = req.body;

  try {
    const user = await prisma.usuarios.findUnique({ where: { id: userId } });
    if (user.rol !== 'profesional') {
      return res.status(403).json({ error: 'Solo los profesionales pueden solicitar verificación.' });
    }

    const profile = await prisma.perfiles_profesionales.update({
      where: { usuario_id: userId },
      data: {
        url_documento_verificacion: url_documento,
        estado_verificación: 'pendiente'
      }
    });

    res.status(200).json({ message: 'Documento de verificación enviado. En revisión.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar documento de verificación.' });
  }
};

exports.reviewVerification = async (req, res) => {
  const { professionalId, action } = req.body; // action: 'approve' o 'reject'

  try {
    let estado_verificación;
    let verificado_en = null;

    if (action === 'approve') {
      estado_verificación = 'verificado';
      verificado_en = new Date();
    } else if (action === 'reject') {
      estado_verificación = 'rechazado';
    } else {
      return res.status(400).json({ error: 'Acción inválida. Usa "approve" o "reject".' });
    }

    const profile = await prisma.perfiles_profesionales.update({
      where: { usuario_id: professionalId },
      data: {
        estado_verificación,
        verificado_en
      }
    });

    res.status(200).json({ message: `Verificación ${action === 'approve' ? 'aprobada' : 'rechazada'} con éxito.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al revisar verificación.' });
  }
};