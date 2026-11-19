import type { Direction, GameManifest } from 'common/gameManifest';
import { MAX_PLAYERS_PER_ROOM } from '../config.js';
import { Player } from './player.js';

export class Room {
    roomCode: string;
    roomSocketId: string;
    players: Player[];
    lastActionTimestamp: number;
    isConnected: boolean = true;
    disconnectTimer?: NodeJS.Timeout | undefined;
    readonly maxPlayers: number;
    phase: 'lobby' | 'playing' = 'lobby';
    selectedGameId: string | null = null;
    game: GameManifest | null = null;

    constructor(roomCode: string, roomSocketId: string, maxPlayers: number = MAX_PLAYERS_PER_ROOM) {
        this.roomCode = roomCode;
        this.roomSocketId = roomSocketId;
        this.players = [];
        this.lastActionTimestamp = Date.now();
        this.maxPlayers = maxPlayers;
    }

    resetDisconnectTimer(): void {
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = undefined;
        }
    }

    updateLastActionTimestamp(): void {
        this.lastActionTimestamp = Date.now();
    }

    addPlayer(player: Player): boolean {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        this.players.push(player);
        this.updateLastActionTimestamp();
        return true;
    }

    removePlayer(socketId: string): void {
        this.players = this.players.filter((player) => player.socketId !== socketId);
        this.updateLastActionTimestamp();
    }

    getPlayersInfos(): {
        name: string;
        playerId: string;
        isConnected: boolean;
        isHost: boolean;
        role: string | null;
        status: string | null;
    }[] {
        return this.players.map((player) => ({
            name: player.name,
            playerId: player.playerId,
            isConnected: player.isConnected,
            isHost: player.isHost,
            role: player.role,
            status: player.status,
        }));
    }

    findPlayer(playerId: string): Player | undefined {
        return this.players.find((player) => player.playerId === playerId);
    }

    moveSelection(direction: Direction, gameIds: string[]): boolean {
        const first = gameIds[0];
        if (first === undefined) {
            return false;
        }

        const current = this.selectedGameId === null ? -1 : gameIds.indexOf(this.selectedGameId);
        if (current === -1) {
            this.selectedGameId = first;
            return true;
        }

        const step = direction === 'up' || direction === 'left' ? -1 : 1;
        const next = gameIds[Math.min(Math.max(current + step, 0), gameIds.length - 1)];
        if (next === undefined || next === this.selectedGameId) {
            return false;
        }

        this.selectedGameId = next;
        return true;
    }

    startGame(manifest: GameManifest): void {
        this.phase = 'playing';
        this.game = manifest;
        this.players.forEach((player) => player.resetGameState());
        this.updateLastActionTimestamp();
    }

    stopGame(): void {
        this.phase = 'lobby';
        this.game = null;
        this.players.forEach((player) => player.resetGameState());
        this.updateLastActionTimestamp();
    }

    migrateHost(): Player | undefined {
        const newHost = this.players[0];
        if (newHost) {
            newHost.isHost = true;

            return newHost;
        } else {
            console.log(`⚠️ Aucun joueur restant pour devenir l'hôte du salon ${this.roomCode}.`);
        }
    }
}
