import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import "../css/bonjour_martin_style.css";

export default function BonjourMartin() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("-");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");
  const [wobble, setWobble] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io("http://localhost:3000");
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id);
      setError("");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setSocketId("-");
    });

    socket.on("connect_error", (err) => {
      setError(err.message);
    });

    socket.on("room_created", (data) => {
      setRoomCode(data.roomCode);
      setError("");
    });

    socket.on("update_players", (updatedPlayers) => {
      setPlayers(Array.isArray(updatedPlayers) ? updatedPlayers : []);
    });

    socket.on("game_info", () => {
    setWobble(false);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
        setWobble(true);
        });
    });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function createRoom() {
    if (!socketRef.current?.connected) {
      setError("Le serveur est déconnecté.");
      return;
    }

    setError("");
    socketRef.current.emit("create_room");
  }

  const showMartin = players.length >= 1;

  const controllerUrl =
    `http://192.168.1.26:5500/client/controller_test.html?roomCode=${encodeURIComponent(roomCode)}`;

  return (
    <main className="bonjour-martin-page">
      <Link className="back-link" to="/">
        ← Retour aux jeux
      </Link>

      <h1>📺 Écran Console (Hôte) — BonjourMartin</h1>

      <section className="card">
        <h3>État de la connexion</h3>

        <p>
          Statut :{" "}
          <span
            className={
              connected ? "status-connected" : "status-disconnected"
            }
          >
            {connected ? "Connecté" : "Déconnecté"}
          </span>
        </p>

        <p>
          Socket ID : <span>{socketId}</span>
        </p>
      </section>

      {!roomCode && (
        <section className="card" id="create-section">
          <h3>Lancer une partie</h3>

          <button id="create-btn" onClick={createRoom}>
            Créer le salon
          </button>

          {error && <div className="error">{error}</div>}
        </section>
      )}

      {roomCode && (
        <section className="card" id="room-info-section">
          <h3>Code du Salon :</h3>

          <div id="active-room-code">{roomCode}</div>

          <p>En attente de joueurs... (Max 8)</p>

          <div className="bm-join-layout">
            <div className="bm-qr-panel">
              <h3>📱 Rejoindre avec un QR code</h3>

              <p>
                Scannez ce code avec votre téléphone pour rejoindre
                le salon.
              </p>

              <div className="qr-code">
                <QRCodeSVG
                  value={controllerUrl}
                  size={200}
                  level="H"
                />
              </div>

              <p>
                Code du salon: <strong>{roomCode}</strong>
              </p>
            </div>

              <div className="bm-martin-panel" id="wait_room_martin">
                <p>Il y a t'il des joueurs..?</p>
                {showMartin && (<p>WOUAH Des Joueurs sont présents! Dites bonjour !</p>)}
                {showMartin && (
                <img
                id="controllerImage"
                className={wobble ? "wobble" : ""}
                onAnimationEnd={() => setWobble(false)}
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTP6pmEf7w2yY2rRwA10Te7leeEus5aiCjXkRm3aObOOA&s=10.png"
                alt="Controller"
                />)}
              </div>
          </div>

          <h4>Joueurs connectés :</h4>

          <ul id="players-list">
            {players.length === 0 ? (
              <li>
                <em>Aucun joueur pour l'instant</em>
              </li>
            ) : (
              players.map((player, index) => (
                <li key={player.id || player.socketId || index}>
                  <span>
                    🎮 <strong>{player.name}</strong>
                  </span>

                  {player.isConnected ? (
                    <span className="player-connected">
                      ● En ligne
                    </span>
                  ) : (
                    <span className="player-disconnected">
                      ⏳ Connexion perdue...
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>

          {error && <div className="error">{error}</div>}
        </section>
      )}
    </main>
  );
}