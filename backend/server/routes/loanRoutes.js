const express = require("express");

const loanController = require("../controllers/loanController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

const studentOnly = [requireAuth, requireRole(["STUDENT"])];

router.get("/loans/current", ...studentOnly, loanController.getCurrentLoans);
router.get("/loans/history", ...studentOnly, loanController.getHistoryLoans);
router.post("/loans", ...studentOnly, loanController.createLoan);
router.post("/loans/return-by-barcode", ...studentOnly, loanController.returnLoanByBarcode);
router.post("/loans/:id/renew", ...studentOnly, loanController.renewLoan);
router.post("/loans/:id/return", ...studentOnly, loanController.returnLoan);
router.post("/loans/:id/pay-fine", ...studentOnly, loanController.payFine);

module.exports = router;
