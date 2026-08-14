import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response.utils';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { env } from '../config/env';

export class AuthController {
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
      const userAgent = req.headers['user-agent'] || '';

      const result = await AuthService.login(identifier, password, ipAddress, userAgent);

      // Set httpOnly cookie for refresh token
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return sendSuccess(
        res,
        {
          accessToken: result.accessToken,
          user: result.user
        },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  public static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { credential, email, firstName, lastName, avatarUrl } = req.body;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
      const userAgent = req.headers['user-agent'] || '';

      const result = await AuthService.loginWithGoogle(
        { credential, email, firstName, lastName, avatarUrl },
        ipAddress,
        userAgent
      );

      // Set httpOnly cookie for refresh token
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return sendSuccess(
        res,
        {
          accessToken: result.accessToken,
          user: result.user
        },
        'Google login successful'
      );
    } catch (error) {
      next(error);
    }
  }


  public static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!token) {
        return res.status(401).json({ success: false, message: 'Refresh token missing' });
      }

      const result = await AuthService.refreshAccessToken(token);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return sendSuccess(
        res,
        { accessToken: result.accessToken },
        'Token refreshed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.userId) {
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
        const userAgent = req.headers['user-agent'] || '';
        await AuthService.logout(req.user.userId, ipAddress, userAgent);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: env.COOKIE_DOMAIN
      });

      return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ success: false, message: 'Unauthenticated' });
      }

      const userProfile = await AuthService.getMe(req.user.userId);
      return sendSuccess(res, userProfile, 'User profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
