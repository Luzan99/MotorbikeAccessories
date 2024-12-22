const express = require("express");
const router = express.Router();
const {
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  getCartItems,
} = require("../controllers/cartController");

const { verifyUser } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/add", verifyUser, addToCart);
router.get("/view", verifyUser, getCartItems);
router.put("/update", verifyUser, updateCartItemQuantity);
router.delete("/remove/:productId", verifyUser, removeFromCart);

module.exports = router;
