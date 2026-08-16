import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/response.utils';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const shape = (schema as any).shape;
      if (shape && (shape.body || shape.query || shape.params)) {
        const parsed: any = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params
        });
        if (parsed?.body !== undefined) {
          req.body = parsed.body;
        }
        if (parsed?.query !== undefined) {
          req.query = parsed.query;
        }
        if (parsed?.params !== undefined) {
          req.params = parsed.params;
        }
      } else {
        req.body = await schema.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => {
          const rawField = err.path.join('.');
          const field = rawField.replace(/^(body|query|params)\./, '');
          return {
            field: field || 'general',
            issue: err.message,
            message: err.message
          };
        });
        next(new AppError('Validation failed', 400, formattedErrors));
      } else {
        next(error);
      }
    }
  };
};
