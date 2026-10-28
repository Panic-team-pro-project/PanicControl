
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "../css/controller_test_style.css";

const SOCKET_URL = "http://localhost:3000";

export default function Controller() {
  const socketRef = useRef(null);
  const pendingJoinRef = useRef(null);
  const joinedRef = useRef(false);
  const playerIdRef = useRef("");

  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(
    "En attente de connexion..."
  );
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Persistent player ID
    let playerId = localStorage.getItem("epi_player_id");

    if (!playerId) {
      playerId = "player_" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem("epi_player_id", playerId);
    }

    playerIdRef.current = playerId;

    // Prefill room code from QR code URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("roomCode");

    if (code) {
      setRoomCode(code.toUpperCase());
    }

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);

      if (joinedRef.current) {
        setFeedback("Connexion rétablie.");
      }

      // Retry a pending join after reconnection
      if (pendingJoinRef.current) {
        const { roomCode, playerName } = pendingJoinRef.current;

        socket.emit(
          "join_room",
          roomCode,
          playerName,
          playerIdRef.current
        );
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);

      if (joinedRef.current) {
        setFeedback("Connexion perdue. Reconnexion...");
      }
    });

    socket.on("player_joined", (data) => {
      if (!data?.roomCode) return;

      joinedRef.current = true;
      pendingJoinRef.current = null;

      setJoined(true);
      setJoining(false);
      setRoomCode(data.roomCode);
      setDisplayName(data.playerName || playerName);
      setFeedback("Manette prête !");
    });

    socket.on("error", (err) => {
      pendingJoinRef.current = null;
      setJoining(false);
      setError(err?.message || "Une erreur est survenue.");
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function handleJoin(event) {
    event.preventDefault();

    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();

    setError("");

    if (!code || !name) {
      setError("Remplis le code du salon et ton pseudo.");
      return;
    }

    const socket = socketRef.current;

    if (!socket?.connected) {
      setError("Le serveur est inaccessible. Réessaie.");
      return;
    }

    setRoomCode(code);
    setPlayerName(name);
    setJoining(true);

    pendingJoinRef.current = {
      roomCode: code,
      playerName: name,
    };

    socket.emit("join_room", code, name, playerIdRef.current);
  }

  function handleAction() {
    const socket = socketRef.current;

    if (!socket?.connected || !joinedRef.current) return;

    socket.emit("game_info", {
      playerId: playerIdRef.current,
      message: "Le joueur a appuyé sur ACTION !",
    });
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
