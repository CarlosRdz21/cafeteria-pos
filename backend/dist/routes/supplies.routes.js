"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supplies_controller_1 = require("../controllers/supplies.controller");
const router = (0, express_1.Router)();
router.get('/', supplies_controller_1.SuppliesController.list);
router.post('/', supplies_controller_1.SuppliesController.create);
router.put('/:id', supplies_controller_1.SuppliesController.update);
exports.default = router;
