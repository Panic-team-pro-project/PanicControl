const ClientEvents = {
    ROOM_CREATED: 'room_created',
    ROOM_CLOSED: 'room_closed',
    ERROR: 'error',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    UPDATE_PLAYERS: 'update_players',
    DISCONNECTED_USER: 'disconnected_user',
} as const;

const ServerEvents = {
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
} as const;

export = { ClientEvents, ServerEvents };
