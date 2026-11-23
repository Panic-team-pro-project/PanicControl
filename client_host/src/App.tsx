import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import BonjourMartin from './pages/BonjourMartin';
import BonjourMartinController from './pages/BonjourMartinController';
import BasicController from './pages/BasicController';
import EpiAirConsole from './pages/EpiAirConsole';

export default function App() {
    return (
        <>
            <main className="container">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/bonjour-martin" element={<BonjourMartin />} />
                    <Route
                        path="/bonjour-martin-controller"
                        element={<BonjourMartinController />}
                    />
                    <Route path="/basic" element={<BasicController />} />
                    <Route path="/airconsole" element={<EpiAirConsole />} />
                    <Route
                        path="*"
                        element={
                            <section className="page">
                                <h1>404 - Page not found</h1>
                                <Link className="button" to="/">
                                    Back to home
                                </Link>
                            </section>
                        }
                    />
                </Routes>
            </main>
        </>
    );
}
