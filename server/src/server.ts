import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { generateRoomCode } from './core/utils.js';
import { RoomManager } from './realtime/roomManager.js';
import { Room } from './realtime/room.js';
import { Player } from './realtime/player.js';

const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

const roomManager = new RoomManager(io);

app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Serveur Express + TS opérationnel ! 🚀' });
});

io.on('connection', (socket) => {
    console.log(`🟢 Un client vient de se connecter ! ID du socket : ${socket.id}`);

    socket.on('create_room', () => {
        const roomCode = generateRoomCode();
        roomManager.createRoom(roomCode, socket.id);

        console.log(`New room created with code: ${roomCode} by host: ${socket.id}`);
        socket.emit('room_created', { roomCode });
        socket.join(roomCode);
    });

    socket.on('join_room', (roomCode: string, playerName: string) => {
        const room = roomManager.getRoom(roomCode);
        if (room) {
            const player = new Player(socket.id, playerName);
            if (!room.addPlayer(player)) {
                console.log(`Room ${roomCode} is full. Client ${socket.id} cannot join.`);
                socket.emit('error', { message: 'Room is full' });
                return;
            }
            socket.join(roomCode);
            console.log(`Client ${socket.id} joined room: ${roomCode}`);
            socket.emit('joined_room', { roomCode });
            io.to(roomCode).emit('update_players', room.players)
        } else {
            console.log(`Client ${socket.id} tried to join non-existent room: ${roomCode}`);
            socket.emit('error', { message: 'Room not found' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔴 Le client ${socket.id} s'est déconnecté.`);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
