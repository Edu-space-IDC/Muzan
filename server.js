const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de salud para Render
app.get('/', (req, res) => {
  res.json({ 
    status: 'Servidor activo', 
    message: 'Bot WhatsApp funcionando',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    port: PORT,
    environment: process.env.NODE_ENV 
  });
});

// Inicializar WhatsApp
async function initWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    const sock = makeWASocket({
      logger: pino({ level: 'error' }),
      printQRInTerminal: true,
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('Escanea el QR code que aparece en la terminal');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        console.log('Conexión cerrada, reconectando...', shouldReconnect);
        if (shouldReconnect) {
          initWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('¡Conectado a WhatsApp!');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Manejar mensajes
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.key.fromMe && m.type === 'notify') {
        console.log('Mensaje recibido:', message);
        
        // Responder automáticamente
        await sock.sendMessage(message.key.remoteJid, { 
          text: '¡Hola! Soy un bot respondiendo automáticamente.' 
        });
      }
    });

  } catch (error) {
    console.error('Error inicializando WhatsApp:', error);
  }
}

// Iniciar servidor
app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor ejecutándose en http://${HOST}:${PORT}`);
  console.log(`📞 Health check disponible en http://${HOST}:${PORT}/health`);
  
  // Iniciar WhatsApp después de que el servidor esté listo
  initWhatsApp();
});
