const db = require("../config/db");

exports.addToWishlist = (req, res) => {
  const userId = req.user.id; // Assume `req.user` is populated by middleware
  const { productId } = req.body;

  // Check if the product is already in the wishlist
  const checkQuery = `SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?`;

  db.query(checkQuery, [userId, productId], (checkErr, results) => {
    if (checkErr) {
      console.error("Error checking wishlist:", checkErr);
      return res.status(500).json({ error: "Failed to check wishlist" });
    }

    if (results.length > 0) {
      // Product already in the wishlist
      return res.status(409).json({ message: "Product already in wishlist" });
    }

    // If not in the wishlist, insert the product
    const insertQuery = `INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)`;

    db.query(insertQuery, [userId, productId], (insertErr) => {
      if (insertErr) {
        console.error("Error adding to wishlist:", insertErr);
        return res.status(500).json({ error: "Failed to add to wishlist" });
      }

      res.status(201).json({ message: "Product added to wishlist" });
    });
  });
};

exports.viewWishlist = (req, res) => {
  const userId = req.user.id;

  const query = `
      SELECT 
        w.id AS wishlist_id, 
        p.id AS product_id, 
        p.name, 
        p.model, 
        p.price AS original_price, 
        p.quantity, 
        p.image_data, 
        IFNULL(SUM(oi.quantity), 0) AS total_sales, 
        p.category AS product_category
      FROM 
        wishlist w
      JOIN 
        products p ON w.product_id = p.id
      LEFT JOIN 
        order_items oi ON p.id = oi.product_id
      LEFT JOIN 
        orders o ON oi.order_id = o.id
      WHERE 
        w.user_id = ?
      GROUP BY 
        w.id, p.id, p.name, p.model, p.price, p.quantity, p.category, p.image_data;
    `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error retrieving wishlist:", err);
      return res.status(500).json({ error: "Failed to retrieve wishlist" });
    }

    // Apply discount logic
    const wishlist = results.map((item) => {
      const price = parseFloat(item.original_price) || 0;
      const totalSales = parseInt(item.total_sales, 10) || 0;
      const category = item.product_category;

      let discountPercentage = 0;
      if (totalSales >= 10) {
        discountPercentage = 15;
      } else if (totalSales >= 5) {
        discountPercentage = 10;
      }
      if (category === "Helmet") {
        discountPercentage += 5;
      }

      const discountAmount = (price * discountPercentage) / 100;
      const discountedPrice = price - discountAmount;

      // Add both discounted and non-discounted prices to the item
      return {
        ...item,
        discounted_price: discountedPrice > 0 ? discountedPrice : price,
        non_discounted_price: price,
        image_data: item.image_data
          ? Buffer.from(item.image_data).toString("base64")
          : null, // Convert image data to base64
      };
    });

    res.status(200).json({ wishlist });
  });
};

exports.removeFromWishlist = (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;

  const query = `DELETE FROM wishlist WHERE user_id = ? AND product_id = ?`;

  db.query(query, [userId, productId], (err) => {
    if (err) {
      console.error("Error removing from wishlist:", err);
      return res.status(500).json({ error: "Failed to remove from wishlist" });
    }

    res.status(200).json({ message: "Product removed from wishlist" });
  });
};
