"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const approval_controller_1 = require("../controllers/approval.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rbac_middleware_1 = require("../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Requests
router.get('/requests', approval_controller_1.ApprovalController.getRequests);
router.post('/requests', approval_controller_1.ApprovalController.createRequest);
router.post('/requests/:id/action', (0, rbac_middleware_1.requirePermission)('approval:manage'), approval_controller_1.ApprovalController.actOnRequest);
// Rules
router.get('/rules', approval_controller_1.ApprovalController.getRules);
router.post('/rules', (0, rbac_middleware_1.requirePermission)('approval:manage'), approval_controller_1.ApprovalController.createRule);
exports.default = router;
