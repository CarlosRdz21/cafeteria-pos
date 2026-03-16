"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supply_categories_controller_1 = require("../controllers/supply-categories.controller");
const router = (0, express_1.Router)();
router.get('/', supply_categories_controller_1.SupplyCategoriesController.list);
router.post('/', supply_categories_controller_1.SupplyCategoriesController.create);
exports.default = router;
