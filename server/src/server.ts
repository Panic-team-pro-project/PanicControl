import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRoutes } from './api/routes.js';
import { SocketManager } from './realtime/socketManager.js';

const PORT = process.env.PORT || 3000;

const app = express();
setupRoutes(app);

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

new SocketManager(io);

server.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
