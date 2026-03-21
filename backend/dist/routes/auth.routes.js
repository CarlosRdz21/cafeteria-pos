"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
router.post('/login', auth_controller_1.AuthController.login);
router.get('/debug/users', auth_controller_1.AuthController.debugUsers);
exports.default = router;
