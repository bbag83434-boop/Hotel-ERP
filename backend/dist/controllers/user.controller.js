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
    static async getUserById(req, res, next) {
        try {
            const user = await user_service_1.UserService.getUserById(req.params.id);
            return (0, response_utils_1.sendSuccess)(res, user, 'User details retrieved successfully');
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
    static async updateUserStatus(req, res, next) {
        try {
            const actorId = req.user?.userId || 'SYSTEM';
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
            const userAgent = req.headers['user-agent'] || '';
            const { isActive } = req.body;
            const updated = await user_service_1.UserService.updateUserStatus(req.params.id, Boolean(isActive), actorId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, updated, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
        }
        catch (error) {
            next(error);
        }
    }
    static async assignUserBranches(req, res, next) {
        try {
            const actorId = req.user?.userId || 'SYSTEM';
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
            const userAgent = req.headers['user-agent'] || '';
            const { branchIds, defaultBranchId } = req.body;
            const userBranches = await user_service_1.UserService.assignUserBranches(req.params.id, branchIds || [], defaultBranchId, actorId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, userBranches, 'User outlet permissions updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getRoles(_req, res, next) {
        try {
            const roles = await user_service_1.UserService.getRoles();
            return (0, response_utils_1.sendSuccess)(res, roles, 'Roles retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getPermissions(_req, res, next) {
        try {
            const permissions = await user_service_1.UserService.getPermissions();
            return (0, response_utils_1.sendSuccess)(res, permissions, 'Permissions retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
