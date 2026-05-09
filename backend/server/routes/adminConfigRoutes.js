const express = require("express");
const adminConfigController = require("../controllers/adminConfigController");

const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
const adminOnly = [requireAuth, requireRole(["ADMIN"])];

router.get("/admin/config", ...adminOnly, adminConfigController.getConfig);
router.put("/admin/config/borrow-rules", ...adminOnly, adminConfigController.updateBorrowRules);
router.put("/admin/config/fine-rate", ...adminOnly, adminConfigController.updateFineRate);

module.exports = router;
