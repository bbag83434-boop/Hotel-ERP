"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
const response_utils_1 = require("../utils/response.utils");
class UserController {
    static async getUsers(_req, res, next) {
        try {
            const users = await user_service_1.UserService.getUsers();
            return (0, response_utils_1.sendSuccess)(res, users, 'Users retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async createUser(req, res, next) {
        try {
            const actorId = req.user?.userId || 'SYSTEM';
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
            const userAgent = req.headers['user-agent'] || '';
            const newUser = await user_service_1.UserService.createUser(req.body, actorId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, newUser, 'User created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
