import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAX_PLAYERS_PER_ROOM } from '../../src/config.js';
import { Player } from '../../src/realtime/player.js';
import { Room } from '../../src/realtime/room.js';

function makePlayer(n: number, isHost = false): Player {
    return new Player(`socket-${n}`, `player-${n}`, `Player ${n}`, isHost);
}

describe('Room', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts empty and connected, with its code and the console socket', () => {
        const room = new Room('ABC123', 'console-socket');

        expect(room.roomCode).toBe('ABC123');
        expect(room.roomSocketId).toBe('console-socket');
        expect(room.players).toEqual([]);
        expect(room.isConnected).toBe(true);
        expect(room.lastActionTimestamp).toBe(Date.now());
    });

    it('adds a player and records the activity', () => {
        const room = new Room('ABC123', 'console-socket');
        vi.advanceTimersByTime(5_000);

        expect(room.addPlayer(makePlayer(1))).toBe(true);
        expect(room.players.map((p) => p.name)).toEqual(['Player 1']);
        expect(room.lastActionTimestamp).toBe(Date.now());
    });

    it('accepts players up to its limit, then refuses the next one', () => {
        const room = new Room('ABC123', 'console-socket', 3);

        const results = [1, 2, 3, 4].map((n) => room.addPlayer(makePlayer(n)));

        expect(results).toEqual([true, true, true, false]);
        expect(room.players).toHaveLength(3);
    });

    it('accepts 8 players with the default limit', () => {
        const room = new Room('ABC123', 'console-socket', DEFAULT_MAX_PLAYERS_PER_ROOM);

        for (let n = 1; n <= 8; n++) {
            expect(room.addPlayer(makePlayer(n))).toBe(true);
        }
        expect(room.addPlayer(makePlayer(9))).toBe(false);
    });

    it('removes a player by socket ID and records the activity', () => {
        const room = new Room('ABC123', 'console-socket');
        room.addPlayer(makePlayer(1));
        room.addPlayer(makePlayer(2));
        vi.advanceTimersByTime(5_000);

        room.removePlayer('socket-1');

        expect(room.players.map((p) => p.name)).toEqual(['Player 2']);
        expect(room.lastActionTimestamp).toBe(Date.now());
    });

    it('lists the players with their name, connection and host status', () => {
        const room = new Room('ABC123', 'console-socket');
        room.addPlayer(makePlayer(1, true));
        room.addPlayer(makePlayer(2));
        room.players[1]!.isConnected = false;

        expect(room.getPlayersInfos()).toMatchObject([
            { name: 'Player 1', isConnected: true, isHost: true, role: null, status: null },
            { name: 'Player 2', isConnected: false, isHost: false, role: null, status: null },
        ]);
    });

    it('lists each player with their player ID', () => {
        const room = new Room('ABC123', 'console-socket');
        room.addPlayer(makePlayer(1));

        expect(room.getPlayersInfos()[0]?.playerId).toBe('player-1');
    });

    it('promotes the first player to host', () => {
        const room = new Room('ABC123', 'console-socket');
        room.addPlayer(makePlayer(1));
        room.addPlayer(makePlayer(2));

        const newHost = room.migrateHost();

        expect(newHost?.name).toBe('Player 1');
        expect(room.players[0]?.isHost).toBe(true);
        expect(room.players[1]?.isHost).toBe(false);
    });

    it('has no host to promote when the room is empty', () => {
        expect(new Room('ABC123', 'console-socket').migrateHost()).toBeUndefined();
    });

    it('starts in the lobby with no selection and no game', () => {
        const room = new Room('ABC123', 'console-socket');

        expect(room.phase).toBe('lobby');
        expect(room.selectedGameId).toBeNull();
        expect(room.game).toBeNull();
    });

    describe('moveSelection', () => {
        const ids = ['a', 'b', 'c'];

        it('selects the first game when nothing is selected', () => {
            const room = new Room('ABC123', 'console-socket');

            expect(room.moveSelection('down', ids)).toBe(true);
            expect(room.selectedGameId).toBe('a');
        });

        it('moves to the next and previous games', () => {
            const room = new Room('ABC123', 'console-socket');
            room.selectedGameId = 'a';

            expect(room.moveSelection('right', ids)).toBe(true);
            expect(room.selectedGameId).toBe('b');
            expect(room.moveSelection('down', ids)).toBe(true);
            expect(room.selectedGameId).toBe('c');
            expect(room.moveSelection('up', ids)).toBe(true);
            expect(room.selectedGameId).toBe('b');
            expect(room.moveSelection('left', ids)).toBe(true);
            expect(room.selectedGameId).toBe('a');
        });

        it('does not wrap around and reports no change at both ends', () => {
            const room = new Room('ABC123', 'console-socket');
            room.selectedGameId = 'a';
            expect(room.moveSelection('up', ids)).toBe(false);
            expect(room.selectedGameId).toBe('a');

            room.selectedGameId = 'c';
            expect(room.moveSelection('down', ids)).toBe(false);
            expect(room.selectedGameId).toBe('c');
        });

        it('stays empty when there is no game', () => {
            const room = new Room('ABC123', 'console-socket');

            expect(room.moveSelection('down', [])).toBe(false);
            expect(room.selectedGameId).toBeNull();
        });
    });

    describe('game phase', () => {
        const manifest = {
            id: 'color-rush',
            name: 'Color Rush',
            version: '1.0.0',
            minPlayers: 1,
            maxPlayers: 4,
            durationMinutes: 5,
            controllerComponents: ['button' as const],
            accessibilityFeatures: [],
            entry: { screen: 'screen.html', controller: 'controller.html' },
        };

        it('starts a game and resets roles and statuses', () => {
            const room = new Room('ABC123', 'console-socket');
            room.addPlayer(makePlayer(1));
            room.players[0]!.role = 'wolf';
            room.players[0]!.status = 'alive';

            room.startGame(manifest);

            expect(room.phase).toBe('playing');
            expect(room.game).toBe(manifest);
            expect(room.players[0]).toMatchObject({ role: null, status: null });
        });

        it('stops the game, back to the lobby, and resets roles and statuses', () => {
            const room = new Room('ABC123', 'console-socket');
            room.addPlayer(makePlayer(1));
            room.startGame(manifest);
            room.players[0]!.role = 'wolf';

            room.stopGame();

            expect(room.phase).toBe('lobby');
            expect(room.game).toBeNull();
            expect(room.players[0]?.role).toBeNull();
        });
    });

    it('finds a player by player ID', () => {
        const room = new Room('ABC123', 'console-socket');
        room.addPlayer(makePlayer(1));

        expect(room.findPlayer('player-1')?.name).toBe('Player 1');
        expect(room.findPlayer('nobody')).toBeUndefined();
    });

    it('cancels its disconnect timer', () => {
        const room = new Room('ABC123', 'console-socket');
        const onTimeout = vi.fn();
        room.disconnectTimer = setTimeout(() => onTimeout(), 30_000);

        room.resetDisconnectTimer();
        vi.advanceTimersByTime(30_000);

        expect(onTimeout).not.toHaveBeenCalled();
        expect(room.disconnectTimer).toBeUndefined();
    });
});
