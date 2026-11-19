import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRoutes } from './api/routes.js';
import { GAMES_DIR, MAX_MESSAGE_BYTES } from './config.js';
import { loadCatalogue } from './games/catalogue.js';
import { SocketManager } from './realtime/socketManager.js';

const PORT = process.env.PORT || 3000;

const app = express();
setupRoutes(app);

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
    maxHttpBufferSize: MAX_MESSAGE_BYTES + 4096,
});

const catalogue = await loadCatalogue(GAMES_DIR);
console.log(`🎲 ${catalogue.list().length} jeu(x) dans le catalogue`);

new SocketManager(io, catalogue);

server.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
