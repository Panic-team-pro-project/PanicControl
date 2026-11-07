import type { Express, Request, Response } from 'express';

export function setupRoutes(app: Express): void {
    app.get('/', (req: Request, res: Response) => {
        res.json({ message: 'Serveur Express + TS opérationnel ! 🚀' });
    });
}
