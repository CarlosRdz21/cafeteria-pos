"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supply_movements_controller_1 = require("../controllers/supply-movements.controller");
const router = (0, express_1.Router)();
router.get('/', supply_movements_controller_1.SupplyMovementsController.list);
router.post('/entry', supply_movements_controller_1.SupplyMovementsController.entry);
router.post('/exit', supply_movements_controller_1.SupplyMovementsController.exit);
exports.default = router;
