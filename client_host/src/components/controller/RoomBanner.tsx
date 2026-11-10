interface RoomBannerProps {
    roomCode: string;
    displayName: string;
}

export function RoomBanner({ roomCode, displayName }: RoomBannerProps) {
    return (
        <div className="room-banner">
            <div>
                <div className="room-label">Salon connecté</div>

                <div>{roomCode}</div>
            </div>

            <div>{displayName}</div>
        </div>
    );
}
