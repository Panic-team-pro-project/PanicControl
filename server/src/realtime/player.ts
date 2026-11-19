export class Player {
    socketId: string;
    playerId: string;
    name: string;
    isConnected: boolean;
    disconnectTimer?: NodeJS.Timeout | undefined;
    isHost: boolean;
    role: string | null = null;
    status: string | null = null;

    constructor(socketId: string, playerId: string, name: string, isHost: boolean = false) {
        this.socketId = socketId;
        this.name = name;
        this.playerId = playerId;
        this.isConnected = true;
        this.isHost = isHost;
    }

    resetGameState(): void {
        this.role = null;
        this.status = null;
    }

    resetDisconnectTimer(): void {
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = undefined;
        }
    }
}
