import { Link } from 'react-router-dom';
import '../css/home_style.css';

const games = [
    {
        title: 'Dites bonjour à Martin',
        emoji: ':D',
        description: "Soyez quelqu'un de cool et dites bonjour à Martin.",
        path: '/bonjour-martin',
        color: 'yellow',
    },
];

export default function Home() {
    return (
        <section className="page">
            <p className="eyebrow">Le fun</p>
            <h1>EpiAirConsole</h1>
            <p className="subtitle">Choisissez un jeu</p>

            <div className="game-grid">
                {games.map((game) => (
                    <Link to={game.path} className={`game-card ${game.color}`} key={game.path}>
                        <span className="game-emoji">{game.emoji}</span>
                        <h2>{game.title}</h2>
                        <p>{game.description}</p>
                        <span className="play-link">Jouer →</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
