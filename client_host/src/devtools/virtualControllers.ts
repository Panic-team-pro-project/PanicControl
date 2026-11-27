import type { ControllerSDK } from 'sdk';

export type ControllerPhase = 'joining' | 'joined' | 'offline' | 'failed';

export interface VirtualController {
    id: number;
    name: string;
    roomCode: string;
    playerId: string | null;
    phase: ControllerPhase;
    connected: boolean;
    isHost: boolean;
    consoleOnline: boolean;
    error: string;
    sdk: ControllerSDK | null;
}

export const PHASE_LABELS: Record<ControllerPhase, string> = {
    joining: 'Connexion…',
    joined: 'En ligne',
    offline: 'Connexion coupée',
    failed: 'Refusée',
};

export function newController(id: number, name: string, roomCode: string): VirtualController {
    return {
        id,
        name,
        roomCode,
        playerId: null,
        phase: 'joining',
        connected: false,
        isHost: false,
        consoleOnline: true,
        error: '',
        sdk: null,
    };
}

export function nextBotName(names: string[]): string {
    const used = new Set(names);
    let number = 1;
    while (used.has(`Bot ${number}`)) number++;
    return `Bot ${number}`;
}

export function normalizeRoomCode(code: string): string {
    return code.trim().toUpperCase();
}
