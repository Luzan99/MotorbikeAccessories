const db = require("../config/db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.checkout = (req, res) => {
  const userId = req.user.id; // Get user ID from the JWT token
  const { shippingAddress, city, postalCode, phoneNumber, paymentMethod } =
    req.body;

  const getCartQuery = "SELECT id FROM carts WHERE user_id = ?";
  db.query(getCartQuery, [userId], (err, cartResults) => {
    if (err) return res.status(500).json({ error: "Failed to fetch cart" });

    const cartId = cartResults[0]?.id;
    if (!cartId) return res.status(404).json({ error: "Cart not found" });

    const getCartItemsQuery = `
      SELECT 
        ci.product_id, 
        ci.quantity, 
        p.price AS product_price, 
        p.quantity AS stock_quantity
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?;
    `;
    db.query(getCartItemsQuery, [cartId], (err, cartItems) => {
      if (err)
        return res.status(500).json({ error: "Failed to fetch cart items" });

      if (!cartItems.length) {
        return res.status(404).json({ error: "No items in the cart" });
      }

      // Check stock
      const insufficientStock = cartItems.some(
        (item) => item.quantity > item.stock_quantity
      );
      if (insufficientStock)
        return res
          .status(400)
          .json({ error: "Insufficient stock for one or more items" });

      // Calculate total price
      const totalPrice = cartItems.reduce(
        (sum, item) => sum + item.quantity * item.product_price,
        0
      );

      const createOrderQuery = `
        INSERT INTO orders (user_id, total_price, shipping_address, city, postal_code, phone_number, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `;
      db.query(
        createOrderQuery,
        [
          userId,
          totalPrice,
          shippingAddress,
          city,
          postalCode,
          phoneNumber,
          paymentMethod,
        ],
        (err, result) => {
          if (err)
            return res.status(500).json({ error: "Failed to create order" });

          const orderId = result.insertId;
          const orderItemsValues = cartItems.map((item) => [
            orderId,
            item.product_id,
            item.quantity,
            item.product_price,
            userId, // Include the user ID for each order item
          ]);

          const insertOrderItemsQuery = `
            INSERT INTO order_items (order_id, product_id, quantity, price, user_id)
            VALUES ?;
          `;
          db.query(insertOrderItemsQuery, [orderItemsValues], (err) => {
            if (err)
              return res
                .status(500)
                .json({ error: "Failed to add items to order" });

            // Update product stock
            cartItems.forEach((item) => {
              const updateProductQuantityQuery = `
                UPDATE products SET quantity = quantity - ? WHERE id = ?;
              `;
              db.query(updateProductQuantityQuery, [
                item.quantity,
                item.product_id,
              ]);
            });

            // Clear cart
            const clearCartQuery = "DELETE FROM cart_items WHERE cart_id = ?";
            db.query(clearCartQuery, [cartId], (err) => {
              if (err)
                return res.status(500).json({ error: "Failed to clear cart" });

              res.status(200).json({
                message: "Order placed successfully",
                orderId,
                totalPrice,
              });
            });
          });
        }
      );
    });
  });
};

exports.handleEsewaSuccess = async (req, res) => {
  const { amt, oid, refId } = req.body; // Use req.query for query parameters

  // Log received payment details for debugging
  console.log("Received payment details:", { amt, oid, refId });

  if (!amt || !oid || !refId) {
    console.error("Missing payment details:", { amt, oid, refId });
    return res.status(400).json({ error: "Missing payment details." });
  }

  try {
    const orderId = oid.replace("order_", ""); // Extract numeric order ID
    console.log("Extracted Order ID:", orderId);

    // Update order status in database
    const [result] = await db.execute(
      `UPDATE orders 
       SET payment_status = 'Completed', 
           transaction_id = ? 
       WHERE id = ?`,
      [refId, orderId]
    );

    if (result.affectedRows === 0) {
      console.error("Order not found or already updated.");
      return res
        .status(404)
        .json({ error: "Order not found or already updated." });
    }

    res.status(200).json({ message: "Payment status updated successfully." });
  } catch (error) {
    console.error("Error updating payment status:", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
};

exports.getCartTotal = (req, res) => {
  const userId = req.user.id;

  const getCartQuery = "SELECT id FROM carts WHERE user_id = ?";
  db.query(getCartQuery, [userId], (err, cartResults) => {
    if (err) {
      console.error("Error fetching cart:", err);
      return res.status(500).json({ error: "Failed to fetch cart" });
    }

    const cartId = cartResults[0]?.id;
    if (!cartId) return res.status(404).json({ error: "Cart not found" });

    const getCartItemsQuery = `
      SELECT 
        ci.product_id, 
        ci.quantity, 
        p.price AS product_price, 
        IFNULL(SUM(oi.quantity), 0) AS total_sales, 
        p.category AS product_category
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE ci.cart_id = ?
      GROUP BY ci.product_id, ci.quantity, p.category, p.price;
    `;
    db.query(getCartItemsQuery, [cartId], (err, cartItems) => {
      if (err) {
        console.error("Error fetching cart items:", err);
        return res.status(500).json({ error: "Failed to fetch cart items" });
      }

      const totalPrice = cartItems.reduce((sum, item) => {
        const price = parseFloat(item.product_price) || 0;
        const total_sales = parseInt(item.total_sales, 10) || 0;
        const category = item.product_category;

        // Discount logic
        let discountPercentage = 0;

        if (total_sales >= 10) {
          discountPercentage = 15;
        } else if (total_sales >= 5) {
          discountPercentage = 10;
        }

        if (category === "Helmet") {
          discountPercentage += 5;
        }

        const discountAmount = (price * discountPercentage) / 100;
        const discountedPrice = price - discountAmount;

        // Use discounted price if applicable, else use the regular price
        const finalPrice = discountedPrice > 0 ? discountedPrice : price;

        return sum + item.quantity * finalPrice;
      }, 0);

      res.status(200).json({ totalPrice: totalPrice.toFixed(2) });
    });
  });
};

// Admin: View all orders
exports.getAllOrders = (req, res) => {
  const getAllOrdersQuery = `
    SELECT 
      o.id, 
      o.user_id, 
      o.total_price, 
      o.shipping_address, 
      o.city, 
      o.postal_code, 
      o.phone_number, 
      o.status, 
      o.created_at, 
      o.updated_at, 
      o.shipping_status, 
      COALESCE(o.payment_method, 'Not Specified') AS payment_method, 
      COALESCE(o.transaction_id, 'Not Available') AS transaction_id,
      o.payment_status,
      u.email
    FROM orders o
    JOIN users u ON o.user_id = u.id
  `;

  db.query(getAllOrdersQuery, (err, orders) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch orders" });
    }

    res.status(200).json({ orders });
  });
};

exports.updateOrderStatus = (req, res) => {
  const { orderId } = req.params;
  let { status, paymentStatus } = req.body;

  // Force paymentStatus to "Completed" if status is updated to "Completed"
  if (status === "Completed") {
    paymentStatus = "Completed";
  }

  const updateOrderStatusQuery =
    "UPDATE orders SET status = ?, payment_status = ? WHERE id = ?";
  const getUserQuery = "SELECT user_id FROM orders WHERE id = ?";
  const insertNotificationQuery =
    "INSERT INTO notifications (user_id, message) VALUES (?, ?)";

  db.query(updateOrderStatusQuery, [status, paymentStatus, orderId], (err) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Failed to update order and payment status" });
    }

    // Fetch user ID and send notification
    db.query(getUserQuery, [orderId], (err, result) => {
      if (err || result.length === 0) {
        return res
          .status(500)
          .json({ error: "Failed to fetch user details for notification" });
      }

      const userId = result[0].user_id;
      const message =
        status === "Completed"
          ? "Thank you for ordering. Your order has been completed."
          : `Your order status has been updated to ${status}.`;

      // Send notification about the updated status
      db.query(insertNotificationQuery, [userId, message], (err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Failed to add notification for user" });
        }

        res.status(200).json({
          message: "Order and payment status updated, and notification sent",
        });
      });
    });
  });
};

exports.updateShippingStatus = (req, res) => {
  const { orderId } = req.params;
  const { shipping_status } = req.body; // 'not yet' or 'shipped'

  const updateShippingQuery =
    "UPDATE orders SET shipping_status = ? WHERE id = ?";
  const getUserQuery = "SELECT user_id FROM orders WHERE id = ?";
  const insertNotificationQuery =
    "INSERT INTO notifications (user_id, message) VALUES (?, ?)";

  db.query(updateShippingQuery, [shipping_status, orderId], (err) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Failed to update shipping status" });

    // Fetch user ID and send notification
    db.query(getUserQuery, [orderId], (err, result) => {
      if (err || result.length === 0)
        return res
          .status(500)
          .json({ error: "Failed to fetch user details for notification" });

      const userId = result[0].user_id;
      const message =
        shipping_status === "shipped"
          ? "Your order has been shipped."
          : `Your order has been ${shipping_status}.`;

      db.query(insertNotificationQuery, [userId, message], (err) => {
        if (err)
          return res
            .status(500)
            .json({ error: "Failed to add notification for user" });

        res
          .status(200)
          .json({ message: "Shipping status updated and notification sent" });
      });
    });
  });
};

// User: View own orders
exports.getUserOrders = (req, res) => {
  const userId = req.user.id;

  // Updated query with null-safe selection for payment_method and transaction_id
  const getUserOrdersQuery = `
    SELECT 
      o.id, 
      o.total_price, 
      o.shipping_address, 
      o.city, 
      o.postal_code, 
      o.phone_number, 
      o.status, 
      o.created_at, 
      o.updated_at, 
      o.shipping_status, 
      COALESCE(o.payment_method, 'Not Specified') AS payment_method, 
      COALESCE(o.transaction_id, 'Not Available') AS transaction_id,
      o.payment_status
    FROM orders o
    WHERE o.user_id = ?
  `;

  db.query(getUserOrdersQuery, [userId], (err, orders) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch orders" });
    }

    res.status(200).json({ orders });
  });
};

exports.downloadOrderPdf = (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  // Fetch the specific order
  const getOrderQuery = `
    SELECT 
      o.id, 
      o.total_price, 
      o.shipping_address, 
      o.city, 
      o.postal_code, 
      o.phone_number, 
      o.status, 
      o.created_at, 
      o.shipping_status, 
      COALESCE(o.payment_method, 'Not Specified') AS payment_method, 
      COALESCE(o.transaction_id, 'Not Available') AS transaction_id,
      o.payment_status
    FROM orders o
    WHERE o.id = ? AND o.user_id = ?
  `;

  db.query(getOrderQuery, [orderId, userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = results[0];
    const pdfPath = path.join(__dirname, `../tmp/order_${order.id}.pdf`);
    const doc = new PDFDocument();

    // Stream the PDF file to the client
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="order_${order.id}.pdf"`
    );

    doc.pipe(res);

    // Title Section
    doc.fontSize(24).text(`Order Receipt`, { align: "center" });
    doc.moveDown(1);

    // Order ID and Date
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(`Order ID: ${order.id}`, { align: "left" });
    doc
      .fontSize(14)
      .font("Helvetica")
      .text(`Ordered On: ${new Date(order.created_at).toLocaleDateString()}`);
    doc.moveDown(0.5);

    // Add a horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Status Section (Bold Title)
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Order Status", { align: "left" });
    doc.fontSize(14).font("Helvetica").text(`Status: ${order.status}`);
    doc.text(`Shipping Status: ${order.shipping_status}`);
    doc.text(`Payment Status: ${order.payment_status}`);
    doc.moveDown(0.5);

    // Add a horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Payment and Transaction Details (Bold Title)
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Payment & Transaction", { align: "left" });
    doc
      .fontSize(14)
      .font("Helvetica")
      .text(`Payment Method: ${order.payment_method}`);
    doc.text(`Transaction ID: ${order.transaction_id}`);
    doc.moveDown(0.5);

    // Add a horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Shipping Information (Bold Title)
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Shipping Information", { align: "left" });
    doc
      .fontSize(14)
      .font("Helvetica")
      .text(`Shipping Address: ${order.shipping_address}`);
    doc.text(`City: ${order.city}`);
    doc.text(`Postal Code: ${order.postal_code}`);
    doc.text(`Phone Number: ${order.phone_number}`);
    doc.moveDown(0.5);

    // Add a horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Price Section (Bold Title)
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Total Price", { align: "left" });
    doc
      .fontSize(14)
      .font("Helvetica")
      .text(`Total Price: Rs ${order.total_price}/-`, { align: "left" });
    doc.moveDown(1);

    // Add Footer (Small Text)
    doc.fontSize(16).text("Thank you for your order!", { align: "center" });

    // Finalize the PDF and end the stream
    doc.end();
  });
};
