import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import "../css/bonjour_martin_style.css";
import { ConsoleSDK } from 'sdk';
import type { PlayerListInfo } from 'sdk';

export default function BonjourMartin() {
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<PlayerListInfo[]>([]);
  const [error, setError] = useState("");
  const [wobble, setWobble] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const sdkRef = useRef<ConsoleSDK | null>(null);

  useEffect(() => {
    const sdk = new ConsoleSDK("http://localhost:3000");
    sdkRef.current = sdk;

    sdk.onConnect(() => {
      setConnected(true);

      const savedRoomCode = localStorage.getItem("console_room_code");
      if (savedRoomCode && !roomCode) {
        handleReconnect(savedRoomCode);
      }
    });

    sdk.onDisconnect((reason) => {
      setConnected(false);
      setError(`Connexion perdue (${reason}). Reconnexion...`);
    });

    sdk.onUpdatePlayers((updatedPlayers) => {
      setPlayers(Array.isArray(updatedPlayers) ? updatedPlayers : []);
    });

    sdk.onGameInfo(() => {
      setWobble(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWobble(true);
        });
      });
    });

    sdk.onRoomClosed((message) => {
      setError(message);
      setRoomCode("");
      localStorage.removeItem("console_room_code");
    });

    sdk.onDisconnectedUser((playerId) => {
      setPlayers((prevPlayers) => prevPlayers.filter(player => player.playerId !== playerId));
    });

    return () => {
      sdk.disconnect();
      sdkRef.current = null;
    };
  }, []);

  async function createRoom() {
    if (!sdkRef.current) {
      setError("Le SDK n'est pas initialisé.");
      return;
    }

    try {
      setError("");
      const roomCode = await sdkRef.current.createRoom();

      setRoomCode(roomCode);
      localStorage.setItem("console_room_code", roomCode);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du salon.");
    }
  }

  async function handleReconnect(codeToReconnect?: string) {
    if (!sdkRef.current) return;

    const code = codeToReconnect || localStorage.getItem("console_room_code");
    if (!code) return;

    setIsReconnecting(true);
    setError("");

    try {
      const activeRoomCode = await sdkRef.current.reconnectToRoom(code);
      setRoomCode(activeRoomCode);
      localStorage.setItem("console_room_code", activeRoomCode);
    } catch (err: any) {
      setError(err.message || "Impossible de se reconnecter au salon.");
      localStorage.removeItem("console_room_code");
    } finally {
      setIsReconnecting(false);
    }
  }

  const savedRoomCode = localStorage.getItem("console_room_code");
  const showMartin = players.length >= 1;

  const controllerUrl =
    `http://localhost:5173/bonjour-martin-controller?roomCode=${encodeURIComponent(roomCode)}`;

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
      </section>

      {!roomCode && savedRoomCode && (
        <section className="card" id="reconnect-section">
          <h3>Salon précédent détecté</h3>
          <p>Un salon ({savedRoomCode}) était en cours.</p>
          <button onClick={() => handleReconnect(savedRoomCode)} disabled={isReconnecting}>
            {isReconnecting ? "Reconnexion..." : `Reprendre le salon ${savedRoomCode}`}
          </button>
          <button onClick={() => localStorage.removeItem("console_room_code")} style={{ marginLeft: "10px" }}>
            Ignorer
          </button>
          {error && <div className="error">{error}</div>}
        </section>
      )}

      {!roomCode && !savedRoomCode && (
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
                <li key={player.playerId || index}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>
                      🎮 <strong>{player.name}</strong>
                    </span>
                    {player.isHost && (
                      <span className="player-host-badge" style={{ fontSize: "0.8rem", background: "#ffd700", color: "#000", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                        👑 Hôte
                      </span>
                    )}
                  </div>

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
