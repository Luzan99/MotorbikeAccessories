const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { verifyUser, verifyAdmin } = require("../middlewares/authMiddleware");

router.post("/checkout", verifyUser, orderController.checkout);
router.get("/total", verifyUser, orderController.getCartTotal);

router.get("/admin/orders", verifyAdmin, orderController.getAllOrders); // Admin route with admin verification
router.put(
  "/admin/orders/:orderId",
  verifyAdmin,
  orderController.updateOrderStatus
);
router.put(
  "/admin/orders/:orderId/shipping",
  verifyAdmin,
  orderController.updateShippingStatus
);
router.post("/payment-success", orderController.handleEsewaSuccess);

// User order tracking
router.get("/user/orders", verifyUser, orderController.getUserOrders);
router.get(
  "/user/orders/:id/pdf",
  verifyUser,
  orderController.downloadOrderPdf
);
module.exports = router;
