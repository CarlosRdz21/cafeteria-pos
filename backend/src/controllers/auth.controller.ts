import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;
      const loginUsername = (username || email || '').toString().trim();

      if (!loginUsername || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const data = await AuthService.login(loginUsername, password);
      res.json(data);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }
}
