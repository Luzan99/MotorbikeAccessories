const express = require("express");
const {
  authMiddleware,
  adminMiddleware,
  ensureAuthenticated,
  ensureAdmin,
  verifyAdmin,
} = require("../middlewares/authMiddleware");
const {
  getUsers,
  approveUser,
  getDashboardData,
} = require("../controllers/adminController");
const router = express.Router();

router.get("/dashboard", verifyAdmin, getDashboardData);

router.get("/users", authMiddleware, adminMiddleware, getUsers);
router.post("/approve", authMiddleware, adminMiddleware, approveUser);

module.exports = router;
