"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const printer_settings_controller_1 = require("../controllers/printer-settings.controller");
const router = (0, express_1.Router)();
router.get('/', printer_settings_controller_1.PrinterSettingsController.get);
router.put('/', printer_settings_controller_1.PrinterSettingsController.upsert);
exports.default = router;
