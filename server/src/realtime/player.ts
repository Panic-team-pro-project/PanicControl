export class Player {
    socketId: string;
    playerId: string;
    name: string;
    isConnected: boolean;
    disconnectTimer?: NodeJS.Timeout;

    constructor(socketId: string, playerId: string, name: string) {
        this.socketId = socketId;
        this.name = name;
        this.playerId = playerId;
        this.isConnected = true;
    }
}
