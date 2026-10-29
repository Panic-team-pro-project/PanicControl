
import { useEffect, useRef, useState } from "react";
import "../css/controller_test_style.css";
import { ControllerSDK } from "sdk";

const SOCKET_URL = "http://localhost:3000";

export default function Controller() {
  const sdkRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("En attente de connexion...");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Prefill room code from QR code URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("roomCode");
    if (code) {
      setRoomCode(code.toUpperCase());
    }

    const sdk = new ControllerSDK(SOCKET_URL);
    sdkRef.current = sdk;
    setConnected(true);

    return () => {
      sdk.disconnect();
      sdkRef.current = null;
    };
  }, []);

  async function handleJoin(event) {
    event.preventDefault();

    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();

    setError("");

    if (!code || !name) {
      setError("Remplis le code du salon et ton pseudo.");
      return;
    }

    if (!sdkRef.current) {
      setError("Le SDK n'est pas initialisé.");
      return;
    }

    setJoining(true);

    const savedPlayerId = localStorage.getItem("player_id");

    try {
      const { playerId: assignedPlayerId } = savedPlayerId
        ? await sdkRef.current.reconnectToRoom(code, name, savedPlayerId)
        : await sdkRef.current.joinRoom(code, name);

      localStorage.setItem("player_id", assignedPlayerId);
      setPlayerId(assignedPlayerId);
      setJoined(true);
      setJoining(false);
      setRoomCode(code);
      setDisplayName(name);
      setFeedback("Manette prête !");
    } catch (err) {
      if (savedPlayerId) {
        localStorage.removeItem("player_id");
      }

      setJoining(false);
      setError(err.message || "Impossible de rejoindre le salon.");
    }
  }

  function handleAction() {
    if (!sdkRef.current || !joined) return;

    if (sdkRef.current.sendAction) {
      sdkRef.current.sendAction({
        playerId: playerId,
        message: "Le joueur a appuyé sur ACTION !",
      });
    }
  }

  return (
    <main className="app">
      <header>
        <div className="brand">
          <div className="logo">🎮</div>
          <div>
            <h1>EpiAirConsole</h1>
            <p className="subtitle">Mobile Controller</p>
          </div>
        </div>

        <div className="status">
          <span
            className={`dot ${connected ? "online" : ""}`}
          />
          <span>
            {connected ? "Connecté" : "Déconnecté"}
          </span>
        </div>
      </header>

      {!joined ? (
        <section className="card">
          <p className="eyebrow">Bienvenue joueur</p>
          <h2>Rejoins la partie</h2>

          <p className="description">
            Entre le code affiché sur l'écran de la console
            pour connecter ta manette.
          </p>

          <form onSubmit={handleJoin}>
            <label htmlFor="room-code">Code du salon</label>
            <input
              id="room-code"
              type="text"
              placeholder="ABCD"
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase())
              }
            />

            <label htmlFor="player-name">Ton pseudo</label>
            <input
              id="player-name"
              type="text"
              placeholder="Ex. Luigi"
              maxLength={15}
              autoComplete="nickname"
              required
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />

            <button
              className="primary-button"
              type="submit"
              disabled={joining}
            >
              {joining
                ? "Connexion..."
                : "Rejoindre la partie →"}
            </button>

            <div className="error" role="alert">
              {error}
            </div>
          </form>
        </section>
      ) : (
        <section>
          <div className="room-banner">
            <div>
              <div className="room-label">Salon connecté</div>
              <div>{roomCode}</div>
            </div>
            <div>{displayName}</div>
          </div>

          <div className="controller-panel">
            <div className="controller-title">
              <p>Appuie sur le bouton pour dire bonjour.</p>
            </div>

            <button
              id="action-button"
              type="button"
              disabled={!connected}
              onClick={handleAction}
            >
              <span>Bonjour :D</span>
            </button>

            <p aria-live="polite">
              {!connected
                ? "Connexion perdue. Reconnexion..."
                : feedback}
            </p>
          </div>
        </section>
      )}

      <footer>EpiAirConsole</footer>
    </main>
  );
}
