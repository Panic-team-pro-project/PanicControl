import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../src/realtime/player.js';

describe('Player', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts connected and not host', () => {
        const player = new Player('socket-1', 'player-1', 'Mario');

        expect(player).toMatchObject({
            socketId: 'socket-1',
            playerId: 'player-1',
            name: 'Mario',
            isConnected: true,
            isHost: false,
        });
        expect(player.disconnectTimer).toBeUndefined();
    });

    it('can be created as the host', () => {
        expect(new Player('socket-1', 'player-1', 'Mario', true).isHost).toBe(true);
    });

    it('cancels its disconnect timer', () => {
        const player = new Player('socket-1', 'player-1', 'Mario');
        const onTimeout = vi.fn();
        player.disconnectTimer = setTimeout(() => onTimeout(), 30_000);

        player.resetDisconnectTimer();
        vi.advanceTimersByTime(30_000);

        expect(onTimeout).not.toHaveBeenCalled();
        expect(player.disconnectTimer).toBeUndefined();
    });
});
