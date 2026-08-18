"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const response_utils_1 = require("../utils/response.utils");
const validate = (schema) => {
    return async (req, _res, next) => {
        try {
            const shape = schema.shape;
            if (shape && (shape.body || shape.query || shape.params)) {
                const parsed = await schema.parseAsync({
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
            }
            else {
                req.body = await schema.parseAsync(req.body);
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const formattedErrors = error.errors.map((err) => {
                    const rawField = err.path.join('.');
                    const field = rawField.replace(/^(body|query|params)\./, '');
                    return {
                        field: field || 'general',
                        issue: err.message,
                        message: err.message
                    };
                });
                next(new response_utils_1.AppError('Validation failed', 400, formattedErrors));
            }
            else {
                next(error);
            }
        }
    };
};
exports.validate = validate;
