"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const expenses_controller_1 = require("../controllers/expenses.controller");
const router = (0, express_1.Router)();
router.get('/', expenses_controller_1.ExpensesController.list);
router.post('/', expenses_controller_1.ExpensesController.create);
exports.default = router;
