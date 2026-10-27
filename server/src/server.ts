import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { generateRoomCode } from './core/utils.js';
import { RoomManager } from './realtime/roomManager.js';
import { Room } from './realtime/room.js';
import { Player } from './realtime/player.js';
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

const socketManager = new SocketManager(io);

server.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
