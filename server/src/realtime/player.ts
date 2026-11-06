export class Player {
    socketId: string;
    playerId: string;
    name: string;
    isConnected: boolean;
    disconnectTimer?: NodeJS.Timeout | undefined;
    isHost: boolean;

    constructor(socketId: string, playerId: string, name: string, isHost: boolean = false) {
        this.socketId = socketId;
        this.name = name;
        this.playerId = playerId;
        this.isConnected = true;
        this.isHost = isHost;
    }

    resetDisconnectTimer(): void {
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = undefined;
        }
    }
}
