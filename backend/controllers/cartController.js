const db = require("../config/db");

// controllers/cartController.js
exports.addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user.id;

  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: "Transaction failed" });

      // Step 1: Check product availability
      connection.query(
        `SELECT quantity FROM products WHERE id = ?`,
        [productId],
        (err, productResults) => {
          if (err) {
            connection.rollback();
            connection.release();
            return res
              .status(500)
              .json({ error: "Failed to check product availability" });
          }

          if (productResults.length === 0) {
            connection.rollback();
            connection.release();
            return res.status(404).json({ error: "Product not found" });
          }

          const availableQuantity = productResults[0].quantity;
          if (quantity > availableQuantity) {
            connection.rollback();
            connection.release();
            return res.status(400).json({
              error: `Only ${availableQuantity} units available in stock`,
            });
          }

          // Step 2: Check or create user cart
          connection.query(
            `SELECT id FROM carts WHERE user_id = ?`,
            [userId],
            (err, cartResults) => {
              if (err) {
                connection.rollback();
                connection.release();
                return res.status(500).json({ error: "Failed to check cart" });
              }

              let cartId;
              if (cartResults.length > 0) {
                cartId = cartResults[0].id;
              } else {
                connection.query(
                  `INSERT INTO carts (user_id) VALUES (?)`,
                  [userId],
                  (err, result) => {
                    if (err) {
                      connection.rollback();
                      connection.release();
                      return res
                        .status(500)
                        .json({ error: "Failed to create cart" });
                    }
                    cartId = result.insertId;
                  }
                );
              }

              // Step 3: Check if the product is already in the cart
              connection.query(
                `SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?`,
                [cartId, productId],
                (err, cartItemResults) => {
                  if (err) {
                    connection.rollback();
                    connection.release();
                    return res
                      .status(500)
                      .json({ error: "Failed to check cart items" });
                  }

                  if (cartItemResults.length > 0) {
                    // Product is already in cart; update quantity
                    const newQuantity = cartItemResults[0].quantity + quantity;
                    connection.query(
                      `UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?`,
                      [newQuantity, cartId, productId],
                      (err) => {
                        if (err) {
                          connection.rollback();
                          connection.release();
                          return res.status(500).json({
                            error: "Failed to update cart item quantity",
                          });
                        }

                        // Update product quantity in stock
                        connection.query(
                          `UPDATE products SET quantity = quantity - ? WHERE id = ?`,
                          [quantity, productId],
                          (err) => {
                            if (err) {
                              connection.rollback();
                              connection.release();
                              return res.status(500).json({
                                error: "Failed to update product quantity",
                              });
                            }

                            connection.commit((err) => {
                              if (err) {
                                connection.rollback();
                                connection.release();
                                return res
                                  .status(500)
                                  .json({ error: "Transaction commit failed" });
                              }

                              connection.release();
                              res.status(200).json({
                                message:
                                  "Product quantity updated in cart successfully",
                              });
                            });
                          }
                        );
                      }
                    );
                  } else {
                    // Product is not in cart; insert new cart item
                    connection.query(
                      `INSERT INTO cart_items (cart_id, product_id, quantity, user_id)
                       VALUES (?, ?, ?, ?)`,
                      [cartId, productId, quantity, userId],
                      (err) => {
                        if (err) {
                          connection.rollback();
                          connection.release();
                          return res
                            .status(500)
                            .json({ error: "Failed to add product to cart" });
                        }

                        // Step 4: Update product quantity in stock
                        connection.query(
                          `UPDATE products SET quantity = quantity - ? WHERE id = ?`,
                          [quantity, productId],
                          (err) => {
                            if (err) {
                              connection.rollback();
                              connection.release();
                              return res.status(500).json({
                                error: "Failed to update product quantity",
                              });
                            }

                            connection.commit((err) => {
                              if (err) {
                                connection.rollback();
                                connection.release();
                                return res
                                  .status(500)
                                  .json({ error: "Transaction commit failed" });
                              }

                              connection.release();
                              res.status(200).json({
                                message: "Product added to cart successfully",
                              });
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          );
        }
      );
    });
  });
};

exports.getCartItems = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT ci.id AS cart_item_id, 
           ci.product_id, 
           ci.quantity, 
           p.name AS product_name, 
           p.price AS product_price, 
           p.image_data,
           IFNULL(SUM(oi.quantity), 0) AS total_sales, 
           p.category AS product_category
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    LEFT JOIN order_items oi ON p.id = oi.product_id
    LEFT JOIN orders o ON oi.order_id = o.id
    JOIN carts c ON ci.cart_id = c.id
    WHERE c.user_id = ?
    GROUP BY ci.id
  `;

  db.query(query, [userId], (error, results) => {
    if (error) {
      console.error("Error viewing cart:", error);
      return res.status(500).json({ error: "Failed to retrieve cart items" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "No items found in cart" });
    }

    // Process each cart item
    const cartItems = results.map((item) => {
      // Calculate discount
      let discountPercentage = 0;
      const price = parseFloat(item.product_price) || 0;
      const total_sales = parseInt(item.total_sales, 10) || 0;
      const category = item.product_category;

      // Discount logic based on total sales
      if (total_sales >= 10) {
        discountPercentage = 15;
      } else if (total_sales >= 5) {
        discountPercentage = 10;
      }

      // Additional discount for "Helmet" category
      if (category === "Helmet") {
        discountPercentage += 5;
      }

      const discountAmount = (price * discountPercentage) / 100;
      const discountedPrice = price - discountAmount;

      // Update price with discounted price if available
      const finalPrice = discountedPrice > 0 ? discountedPrice : price;

      // Convert image_data (binary) to base64 string for easy use in frontend
      if (item.image_data) {
        item.image_data = Buffer.from(item.image_data).toString("base64");
      }

      // Return the item with the final price
      return {
        ...item,
        final_price: finalPrice.toFixed(2), // Adding the final price for the cart item
        discount_percentage: discountPercentage,
        discount_amount: discountAmount.toFixed(2),
      };
    });

    res.status(200).json({ cartItems });
  });
};

exports.updateCartItemQuantity = (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  if (quantity <= 0) {
    return res
      .status(400)
      .json({ error: "Quantity must be greater than zero" });
  }

  // Fetch the current cart item quantity
  db.query(
    `SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?`,
    [userId, productId],
    (err, cartResult) => {
      if (err) {
        console.error("Error fetching cart item:", err);
        return res.status(500).json({ error: "Failed to fetch cart item" });
      }

      if (cartResult.length === 0) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      const currentQuantity = cartResult[0].quantity;
      const quantityChange = quantity - currentQuantity;

      // Fetch the product stock
      db.query(
        `SELECT quantity FROM products WHERE id = ?`,
        [productId],
        (err, productResult) => {
          if (err) {
            console.error("Error fetching product:", err);
            return res.status(500).json({ error: "Failed to fetch product" });
          }

          if (productResult.length === 0) {
            return res.status(404).json({ error: "Product not found" });
          }

          const productStock = productResult[0].quantity;

          if (productStock < quantityChange) {
            return res
              .status(400)
              .json({ error: "Insufficient stock for this product" });
          }

          // Update the cart item quantity
          db.query(
            `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`,
            [quantity, userId, productId],
            (err) => {
              if (err) {
                console.error("Error updating cart item quantity:", err);
                return res
                  .status(500)
                  .json({ error: "Failed to update cart item quantity" });
              }

              // Update the product stock
              db.query(
                `UPDATE products SET quantity = quantity - ? WHERE id = ?`,
                [quantityChange, productId],
                (err) => {
                  if (err) {
                    console.error("Error updating product stock:", err);
                    return res
                      .status(500)
                      .json({ error: "Failed to update product stock" });
                  }

                  res.status(200).json({
                    message: "Cart item quantity updated successfully",
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

exports.removeFromCart = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;

  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: "Transaction failed" });
      }

      // Step 1: Get the quantity of the product in the cart
      connection.query(
        `SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?`,
        [userId, productId],
        (err, results) => {
          if (err || results.length === 0) {
            connection.rollback();
            connection.release();
            return res.status(404).json({ error: "Product not found in cart" });
          }

          const cartQuantity = results[0].quantity;

          // Step 2: Remove the product from cart_items
          connection.query(
            `DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`,
            [userId, productId],
            (err) => {
              if (err) {
                connection.rollback();
                connection.release();
                return res
                  .status(500)
                  .json({ error: "Failed to remove product from cart" });
              }

              // Step 3: Restore the product quantity in the inventory
              connection.query(
                `UPDATE products SET quantity = quantity + ? WHERE id = ?`,
                [cartQuantity, productId],
                (err) => {
                  if (err) {
                    connection.rollback();
                    connection.release();
                    return res
                      .status(500)
                      .json({ error: "Failed to restore product quantity" });
                  }

                  connection.commit((err) => {
                    if (err) {
                      connection.rollback();
                      connection.release();
                      return res
                        .status(500)
                        .json({ error: "Transaction commit failed" });
                    }

                    connection.release();
                    res.status(200).json({
                      message: "Product removed from cart successfully",
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};
