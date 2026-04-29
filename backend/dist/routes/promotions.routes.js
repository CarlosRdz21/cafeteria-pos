"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promotions_controller_1 = require("../controllers/promotions.controller");
const router = (0, express_1.Router)();
router.get('/', promotions_controller_1.PromotionsController.list);
router.put('/', promotions_controller_1.PromotionsController.upsert);
router.delete('/:id', promotions_controller_1.PromotionsController.remove);
exports.default = router;
