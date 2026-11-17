import { randomInt } from 'node:crypto';

// No 0, O, 1 or I: players type the code on a phone, where those are easy to mix up
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
    }

    return code;
}

export function generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 10);
}
