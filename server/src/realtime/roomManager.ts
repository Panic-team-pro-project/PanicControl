import { Room } from './room.js';
import type { Server } from 'socket.io';
import eventsCodes from 'common';

const { ClientEvents } = eventsCodes;

export class RoomManager {
    private rooms: Map<string, Room>;
    private cleanupInterval: NodeJS.Timeout;
    private readonly ROOM_INACTIVITY_THRESHOLD = 15 * 60 * 1000; // 15 minutes
    private readonly ROOM_CLEANUP_INTERVAL = 60 * 1000; // 60 seconds
    private io: Server;

    constructor(io: Server) {
        this.io = io;
        this.rooms = new Map<string, Room>();

        this.cleanupInterval = setInterval(() => {
            this.cleanInactiveRooms(this.ROOM_INACTIVITY_THRESHOLD); // Exire après 15 minutes d'inactivité
        }, 60 * 1000);

        // DEBUG:
        // this.cleanupInterval = setInterval(() => {
        // this.cleanInactiveRooms(30 * 1000);
        // }, 10 * 1000);
    }

    private cleanInactiveRooms(inactivityThreshold: number): void {
        const now = Date.now();
        for (const [roomCode, room] of this.rooms.entries()) {
            if (now - room.lastActionTimestamp > inactivityThreshold) {
                console.log(
                    `Room ${roomCode} has been inactive for more than 15 minutes. Removing it.`,
                );

                this.rooms.delete(roomCode);

                this.io.to(roomCode).emit(ClientEvents.ROOM_CLOSED, {
                    message: 'Room has been closed due to inactivity.',
                });
            }
        }
    }

    createRoom(roomCode: string, hostSocketId: string): Room {
        const room = new Room(roomCode, hostSocketId);
        this.rooms.set(roomCode, room);

        return room;
    }

    getRoom(roomCode: string): Room | undefined {
        const room = this.rooms.get(roomCode);
        if (room) {
            room.updateLastActionTimestamp();
        }

        return room;
    }

    removeRoom(roomCode: string): void {
        this.rooms.delete(roomCode);
    }
}
