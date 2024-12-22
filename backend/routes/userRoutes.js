const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyUser } = require("../middlewares/authMiddleware"); // Middleware for JWT validation

// Route to get user profile
router.get("/profile", verifyUser, userController.getUserProfile);

// Route to edit user profile
router.put("/profile", verifyUser, userController.updateUserProfile);

module.exports = router;
