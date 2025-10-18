import moment from "moment";
import { getConfig, saveConfig } from "../utils/storage.js";
import { reportDelay, randomDelay } from "../utils/delay.js"; // ← AÑADIR

export async function getAdminList(sock, jid) {
  try {
    const metadata = await sock.groupMetadata(jid);
    return metadata.participants.map(p => p.id);
  } catch {
    return [];
  }
}

export async function sendReport(sock, msg, args, config, sender, from) {
  try {
    // Verificar si hay configuración de grupo específico
    const groupType = config.groupTypes ? config.groupTypes[from] : null;

    let reportChat = null;
    let reportsActive = false;

    if (groupType && config.reportGroups && config.reportGroups[groupType]) {
      // Usar configuración de grupo específico (g1/g2)
      reportChat = config.reportGroups[groupType];
      reportsActive = config.reportGroupActive && config.reportGroupActive[groupType] === true;

      console.log(`📊 Usando configuración de grupo ${groupType.toUpperCase()}:`, {
        reportChat,
        reportsActive,
        fromGroup: from
      });
    } else {
      // No hay configuración de grupo - no enviar reportes
      await sock.sendMessage(from, {
        text: `❌ Este grupo no está configurado. Usa ${config.prefix}setg1 on o ${config.prefix}setg2 on para configurarlo.`
      });
      return;
    }

    // Verificar si los reportes están activos
    if (!reportsActive) {
      await sock.sendMessage(from, { text: "❌ Los reportes están desactivados para este grupo." });
      return;
    }

    if (!reportChat) {
      await sock.sendMessage(from, {
        text: `❌ No hay chat configurado para reportes de ${groupType.toUpperCase()}. Usa ${config.prefix}report ${groupType} on en el chat destino.`
      });
      return;
    }

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    // Obtener al usuario mencionado o respondido
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const replied = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const userToKick = mentioned || replied;

    if (!userToKick) {
      await sock.sendMessage(from, { text: "❌ Debes mencionar o responder al usuario que será expulsado." });
      return;
    }

    // ✅ PREVENIR AUTO-EXPULSIÓN
    if (userToKick === sender) {
      await sock.sendMessage(from, {
        text: "❌ No puedes expulsarte a ti mismo."
      });
      return;
    }

    // Obtener el motivo correctamente
    let motivo = "";

    if (mentioned) {
      // Caso 1: Se mencionó al usuario (.kick @usuario motivo)
      // Remover el comando y la mención para obtener solo el motivo
      const commandParts = body.split(' ');
      const userIndex = commandParts.findIndex(part => part.includes('@'));
      if (userIndex !== -1) {
        motivo = commandParts.slice(userIndex + 1).join(' ').trim();
      }
    } else {
      // Caso 2: Se respondió al mensaje (.kick motivo)
      // Todo después del comando es el motivo
      const commandParts = body.split(' ');
      motivo = commandParts.slice(1).join(' ').trim();
    }

    if (!motivo) motivo = "Sin motivo especificado";

    // Buscar emoji de gravedad según los niveles configurados
    let gravedadEmoji = "⚪"; // Default
    for (const [nivel, emoji] of Object.entries(config.levels)) {
      if (motivo.toLowerCase().includes(nivel.toLowerCase())) {
        gravedadEmoji = emoji;
        break;
      }
    }

    // Obtener información del usuario expulsado
    let userInfo = "";
    let userNumberFormatted = "";

    try {
      // Intentar obtener el nombre del usuario del grupo
      if (from.endsWith("@g.us")) {
        const groupMetadata = await sock.groupMetadata(from);
        const participant = groupMetadata.participants.find(p => p.id === userToKick);
        if (participant) {
          userInfo = participant.name || participant.notify || participant.id.split('@')[0];
        }
      }

      // Si no se pudo obtener el nombre, usar solo el número
      if (!userInfo) {
        userInfo = userToKick.split('@')[0];
      }

      // Formatear el número para mostrar
      const userNumber = userToKick.split('@')[0];
      userNumberFormatted = formatPhoneNumber(userNumber);

    } catch (error) {
      console.error("Error obteniendo información del usuario:", error);
      userInfo = userToKick.split('@')[0];
      userNumberFormatted = formatPhoneNumber(userToKick.split('@')[0]);
    }

    // Formatear número del que ejecuta el comando
    const senderNumber = sender.split('@')[0];
    const senderNumberFormatted = formatPhoneNumber(senderNumber);

    const fecha = moment().format("DD/MM/YYYY HH:mm");

    // TEXTO DEL REPORTE CON INFORMACIÓN DEL GRUPO
    const texto = `> 📢 *FORMATO DE REPORTE - ${groupType.toUpperCase()}*\n\n` +
      `*Expulsión realizada por*: @${senderNumberFormatted}\n` +
      `👤 *Usuario expulsado*: @${userToKick.split('@')[0]}\n` +
      `📆 *Fecha*: ${fecha}\n` +
      `⚠️ *Motivo*: ${motivo}\n` +
      `🔎 *Gravedad*: ${gravedadEmoji}\n` +
      `🏷️ *Grupo origen*: ${groupType.toUpperCase()}`;


    // 🔄 RETRASO ANTES DE ENVIAR REPORTE
    await reportDelay();

    // Enviar reporte al chat correspondiente con menciones correctas
    await sock.sendMessage(reportChat, {
      text: texto,
      mentions: [userToKick, sender] // Mencionar al usuario expulsado y al que ejecutó
    });

    // ✅ RECREACIÓN EXACTA AL ESTILO SUMMI BOT .fake
    try {
      const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quotedMessage) {

        // Obtener información del usuario que envió el mensaje
        let userName = "Usuario";
        try {
          const quotedSender = msg.message.extendedTextMessage.contextInfo.participant;
          if (from.endsWith("@g.us")) {
            const groupMetadata = await sock.groupMetadata(from);
            const participant = groupMetadata.participants.find(p => p.id === quotedSender);
            if (participant) {
              userName = participant.name || participant.notify || quotedSender.split('@')[0];
            }
          } else {
            userName = quotedSender.split('@')[0];
          }
        } catch (e) {
          userName = msg.message.extendedTextMessage.contextInfo.participant.split('@')[0];
        }

        // 🔄 RETRASO ENTRE MENSAJES
        await randomDelay(500, 1500);

        // Enviar mensaje de evidencia
        await sock.sendMessage(reportChat, {
          text: `📎 *Evidencia: mensaje de ${userName}*`
        });


        // 🔄 RETRASO ANTES DE REENVIAR
        await randomDelay(500, 1500);

        // Función para copiar objetos (como en Summi Bot)
        const copy = (obj) => JSON.parse(JSON.stringify(obj));

        // Crear una copia exacta del mensaje
        let fakeMsg = copy(msg);

        // Configurar como en Summi Bot
        fakeMsg.key.fromMe = false;
        fakeMsg.key.remoteJid = reportChat;

        // Determinar el remitente (quien envió el mensaje original)
        let who = msg.message.extendedTextMessage.contextInfo.participant;

        // Si es un grupo, usar el participante original
        if (from.endsWith("@g.us")) {
          fakeMsg.key.participant = who;
        } else {
          fakeMsg.key.participant = who;
        }

        // Copiar el mensaje original exactamente
        fakeMsg.message = copy(quotedMessage);

        // Enviar el mensaje recreado (igual que Summi Bot)
        await sock.relayMessage(reportChat, fakeMsg.message, {
          messageId: fakeMsg.key.id
        });

      }
    } catch (forwardError) {
      console.log("⚠️ No se pudo recrear el mensaje estilo Summi Bot:", forwardError);
    }

    // Expulsar del grupo si es grupo
    if (from.endsWith("@g.us")) {
      try {
        await sock.groupParticipantsUpdate(from, [userToKick], "remove");
      } catch (err) {
        console.error("❌ Error expulsando usuario:", err);
        await sock.sendMessage(from, { text: "⚠️ No se pudo expulsar al usuario, verifica permisos." });
      }
    }

  } catch (err) {
    console.error("❌ Error en sendReport:", err);
    await sock.sendMessage(from, { text: "❌ Ocurrió un error al enviar el reporte." });
  }
}

// Función auxiliar para formatear números de teléfono
function formatPhoneNumber(number) {
  // Remover cualquier caracter no numérico
  const cleanNumber = number.replace(/\D/g, '');

  // Formatear según la longitud del número
  if (cleanNumber.length === 12) {
    // Formato: 57 318 035 5926
    return cleanNumber.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  } else if (cleanNumber.length === 11) {
    // Formato: 57 318 035 592
    return cleanNumber.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  } else if (cleanNumber.length === 10) {
    // Formato: 318 035 5926
    return cleanNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  } else if (cleanNumber.length === 9) {
    // Formato: 318 035 592
    return cleanNumber.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }

  // Si no coincide con ningún formato conocido, devolver el número limpio
  return cleanNumber;
}