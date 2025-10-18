import { saveConfig } from "../utils/storage.js";
import { commandDelay, responseDelay } from "../utils/delay.js"; // ← AÑADIR

export async function handleSystemCommand(sock, from, sender, cmd, args, config, isOwner) {
  // En grupos, cualquier admin puede usar estos comandos
  // En chats privados, solo el owner puede usar comandos

  // Verificar permisos según el tipo de chat
  if (from.endsWith("@g.us")) {
    // En grupos: cualquier admin puede usar los comandos
    // No se necesita verificación adicional ya que functions.js ya validó que es admin
  } else {
    // En chats privados: solo el owner puede usar comandos
    if (!isOwner) {
      return sock.sendMessage(from, { text: "❌ Solo el owner puede usar comandos en chats privados." });
    }
  }

  // 🔄 RETRASO ANTES DE PROCESAR COMANDO DEL SISTEMA
  await commandDelay();

  switch (cmd.toLowerCase()) {
    case "prefix":
      if (!args[0])
        return sock.sendMessage(from, { text: "❗ Usa: .prefix nuevoPrefijo" });
      config.prefix = args[0];
      saveConfig(config);
      sock.sendMessage(from, { text: `✅ Prefijo cambiado a: ${args[0]}` });
      break;

    case "setg1":
    case "setg2":
      const groupType = cmd.toLowerCase().replace('setg', 'g');

      if (args[0] === "on") {
        // Configurar este grupo como g1 o g2
        if (!config.groupTypes) config.groupTypes = {};
        config.groupTypes[from] = groupType;

        saveConfig(config);
        sock.sendMessage(from, {
          text: `✅ Este grupo ha sido configurado como *${groupType.toUpperCase()}*`
        });
      } else if (args[0] === "off") {
        // Remover configuración de grupo
        if (!config.groupTypes) config.groupTypes = {};
        delete config.groupTypes[from];

        saveConfig(config);
        sock.sendMessage(from, {
          text: `🚫 Configuración de grupo removida`
        });
      } else {
        sock.sendMessage(from, {
          text: `❗ Usa: ${config.prefix}${cmd} on / off`
        });
      }
      break;

    case "report":
      if (args[0] === "g1" || args[0] === "g2") {
        const groupKey = args[0];

        if (args[1] === "on") {
          // Configurar este chat como destino de reportes para g1 o g2
          if (!config.reportGroups) config.reportGroups = {};
          config.reportGroups[groupKey] = from;

          if (!config.reportGroupActive) config.reportGroupActive = {};
          config.reportGroupActive[groupKey] = true;

          saveConfig(config);
          sock.sendMessage(from, {
            text: `✅ Reportes para *${groupKey.toUpperCase()}* activados en este chat`
          });
        } else if (args[1] === "off") {
          // Desactivar reportes para g1 o g2
          if (!config.reportGroupActive) config.reportGroupActive = {};
          config.reportGroupActive[groupKey] = false;

          saveConfig(config);
          sock.sendMessage(from, {
            text: `🚫 Reportes para *${groupKey.toUpperCase()}* desactivados`
          });
        } else {
          sock.sendMessage(from, {
            text: `❗ Usa: ${config.prefix}report ${groupKey} on / off`
          });
        }
      } else {
        sock.sendMessage(from, {
          text: `❗ Usa:\n${config.prefix}report g1 on/off (reportes para grupo g1)\n${config.prefix}report g2 on/off (reportes para grupo g2)`
        });
      }
      break;

    case "setrev":
      if (args[0] === "g1" || args[0] === "g2") {
        const groupKey = args[0];

        if (args[1] === "on") {
          // Configurar este chat como destino de reenvíos para g1 o g2
          if (!config.revGroups) config.revGroups = {};
          config.revGroups[groupKey] = from;

          if (!config.revGroupActive) config.revGroupActive = {};
          config.revGroupActive[groupKey] = true;

          saveConfig(config);
          sock.sendMessage(from, {
            text: `✅ Reenvíos para *${groupKey.toUpperCase()}* activados en este chat`
          });
        } else if (args[1] === "off") {
          // Desactivar reenvíos para g1 o g2
          if (!config.revGroupActive) config.revGroupActive = {};
          config.revGroupActive[groupKey] = false;

          saveConfig(config);
          sock.sendMessage(from, {
            text: `🚫 Reenvíos para *${groupKey.toUpperCase()}* desactivados`
          });
        } else {
          sock.sendMessage(from, {
            text: `❗ Usa: ${config.prefix}setrev ${groupKey} on / off`
          });
        }
      } else {
        sock.sendMessage(from, {
          text: `❗ Usa:\n${config.prefix}setrev g1 on/off (reenvíos para grupo g1)\n${config.prefix}setrev g2 on/off (reenvíos para grupo g2)`
        });
      }
      break;

    case "bot":
      // ✅ ESTE COMANDO SIEMPRE FUNCIONA, INCLUSO CUANDO EL BOT ESTÁ DESACTIVADO
      if (args[0] === "on") {
        if (!config.botActive) config.botActive = {};
        config.botActive[from] = true;
        saveConfig(config);
        sock.sendMessage(from, { text: "🤖 Bot activado en este chat." });
      } else if (args[0] === "off") {
        if (!config.botActive) config.botActive = {};
        config.botActive[from] = false;
        saveConfig(config);
        sock.sendMessage(from, { text: "🛑 Bot desactivado en este chat." });
      } else {
        sock.sendMessage(from, { text: "❗ Usa: .bot on / off" });
      }
      break;

    case "reload":
      // Solo el owner puede reiniciar el bot (por seguridad)
      if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Solo el owner puede reiniciar el bot." });
      }
      sock.sendMessage(from, { text: "🔄 Reiniciando bot..." });
      process.exit(0);
      break;

    case "setowner":
      // Solo el owner actual puede cambiar el owner
      if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Solo el owner actual puede cambiar el owner." });
      }

      if (!args[0]) {
        return sock.sendMessage(from, { text: "❗ Usa: .setowner [número]@s.whatsapp.net" });
      }

      let newOwner = args[0];
      if (!newOwner.includes('@s.whatsapp.net')) {
        newOwner = newOwner + '@s.whatsapp.net';
      }

      config.owner = newOwner;
      saveConfig(config);
      sock.sendMessage(from, { text: `✅ Owner cambiado a: ${newOwner}` });
      break;
  }
}