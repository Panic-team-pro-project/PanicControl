import type { Server } from 'socket.io';
import eventsCodes from 'common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateRoomCode } from '../../src/core/utils.js';
import { RoomManager } from '../../src/realtime/roomManager.js';

// The real generator, wrapped so a test can force the codes it returns
vi.mock('../../src/core/utils.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/core/utils.js')>();
    return { ...actual, generateRoomCode: vi.fn(actual.generateRoomCode) };
});

const { ClientEvents } = eventsCodes;
const MINUTE = 60_000;

// Only the part of Socket.IO that RoomManager uses: io.to(room).emit(...)
function makeIo() {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    return { io: { to } as unknown as Server, to, emit };
}

describe('RoomManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('creates a room and finds it by its code', () => {
        const manager = new RoomManager(makeIo().io);

        const room = manager.createRoom('ABC123', 'console-socket');

        expect(manager.getRoom('ABC123')).toBe(room);
        expect(room.roomSocketId).toBe('console-socket');
    });

    it('finds no room for an unknown code', () => {
        expect(new RoomManager(makeIo().io).getRoom('NOPE00')).toBeUndefined();
    });

    it('gives a new room a code that no open room uses', () => {
        const manager = new RoomManager(makeIo().io);
        manager.createRoom('AAAAAA', 'console-socket');
        vi.mocked(generateRoomCode).mockReturnValueOnce('AAAAAA').mockReturnValueOnce('BBBBBB');

        expect(manager.generateUniqueRoomCode()).toBe('BBBBBB');
    });

    it('generates a valid code when no room is open', () => {
        expect(new RoomManager(makeIo().io).generateUniqueRoomCode()).toMatch(
            /^[A-HJ-NP-Z2-9]{6}$/,
        );
    });

    it('removes a room', () => {
        const manager = new RoomManager(makeIo().io);
        manager.createRoom('ABC123', 'console-socket');

        manager.removeRoom('ABC123');

        expect(manager.getRoom('ABC123')).toBeUndefined();
    });

    it('records the activity when a room is looked up', () => {
        const manager = new RoomManager(makeIo().io);
        const room = manager.createRoom('ABC123', 'console-socket');
        vi.advanceTimersByTime(5 * MINUTE);

        manager.getRoom('ABC123');

        expect(room.lastActionTimestamp).toBe(Date.now());
    });

    it('closes a room after 15 minutes without activity and tells its members', () => {
        const { io, to, emit } = makeIo();
        const manager = new RoomManager(io);
        manager.createRoom('ABC123', 'console-socket');

        vi.advanceTimersByTime(16 * MINUTE);

        expect(to).toHaveBeenCalledWith('ABC123');
        expect(emit).toHaveBeenCalledWith(ClientEvents.ROOM_CLOSED, {
            message: 'Room has been closed due to inactivity.',
        });
        expect(manager.getRoom('ABC123')).toBeUndefined();
    });

    it('keeps a room that is still in use', () => {
        const { io, emit } = makeIo();
        const manager = new RoomManager(io);
        manager.createRoom('ABC123', 'console-socket');

        vi.advanceTimersByTime(10 * MINUTE);
        manager.getRoom('ABC123');
        vi.advanceTimersByTime(10 * MINUTE);

        expect(emit).not.toHaveBeenCalled();
        expect(manager.getRoom('ABC123')).toBeDefined();
    });
});
