
import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import BonjourMartin from "./pages/BonjourMartin";
import BonjourMartinController from "./pages/BonjourMartinController";

export default function App() {
  return (
    <>
      <header className="navbar">
        <Link to="/" className="brand">🎮 EpiAirConsole</Link>
        <Link to="/" className="nav-link">Home</Link>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bonjour-martin" element={<BonjourMartin />} />
          <Route path="/bonjour-martin-controller" element={<BonjourMartinController />} />
          <Route
            path="*"
            element={
              <section className="page">
                <h1>404 - Page not found</h1>
                <Link className="button" to="/">Back to home</Link>
              </section>
            }
          />
        </Routes>
      </main>
    </>
  );
}
