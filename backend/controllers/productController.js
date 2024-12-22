const fs = require("fs");
const db = require("../config/db");

// Helper function to convert image data to Base64
const formatProducts = (products) => {
  return products.map((product) => ({
    ...product,
    image_data: product.image_data
      ? Buffer.from(product.image_data).toString("base64")
      : null,
  }));
};

// Create a new product
exports.createProduct = (req, res) => {
  const {
    name,
    model,
    category,
    quantity,
    price,
    description,
    dimensions,
    weight,
    manufacturer,
    warranty_period,
  } = req.body;

  const imageData = req.file ? fs.readFileSync(req.file.path) : null;

  // Check if a product with the same name, model, and category already exists
  const checkSql =
    "SELECT * FROM products WHERE name = ? AND model = ? AND category = ?";
  db.query(checkSql, [name, model, category], (checkErr, checkResult) => {
    if (checkErr) {
      console.error("Error checking for existing product:", checkErr);
      return res
        .status(500)
        .json({ message: "Error checking for duplicate product" });
    }

    if (checkResult.length > 0) {
      return res.status(409).json({
        message:
          "Product with the same name, model, and category already exists",
      });
    }

    // Insert the new product if no duplicate was found
    const insertSql = `
      INSERT INTO products 
      (name, model, category, quantity, price, description, dimensions, weight, manufacturer, warranty_period, image_data) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      insertSql,
      [
        name,
        model,
        category,
        quantity,
        price,
        description,
        dimensions,
        weight,
        manufacturer,
        warranty_period,
        imageData,
      ],
      (insertErr, result) => {
        if (insertErr) {
          console.error("Error inserting product:", insertErr);
          return res.status(500).json({ message: "Error creating product" });
        }

        res
          .status(201)
          .json({ message: "Product created", productId: result.insertId });
      }
    );
  });
};

// Get all products
exports.getAllProducts = (req, res) => {
  const sql = `
    SELECT id, name, model, category, quantity, price, description, dimensions, weight, manufacturer, warranty_period, image_data ,total_quantity_sold
    FROM products
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).json({ message: "Error fetching products" });
    }

    res.json(formatProducts(results));
  });
};

// Get a product by ID
exports.getProductById = (req, res) => {
  const productId = req.params.id;
  const sql = `
    SELECT id, name, model, category, quantity, price, description, dimensions, weight, manufacturer, warranty_period, image_data 
    FROM products 
    WHERE id = ?
  `;
  db.query(sql, [productId], (err, results) => {
    if (err) {
      console.error("Error fetching product:", err);
      return res.status(500).json({ message: "Error fetching product" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(formatProducts(results)[0]);
  });
};

// Update a product
exports.updateProduct = (req, res) => {
  const {
    name,
    model,
    category,
    quantity,
    price,
    description,
    dimensions,
    weight,
    manufacturer,
    warranty_period,
  } = req.body;

  const imageData = req.file ? fs.readFileSync(req.file.path) : null;
  const productId = req.params.id;

  const updateSql = `
    UPDATE products 
    SET name = ?, model = ?, category = ?, quantity = ?, price = ?, description = ?, dimensions = ?, weight = ?, manufacturer = ?, warranty_period = ?, image_data = ? 
    WHERE id = ?
  `;
  db.query(
    updateSql,
    [
      name,
      model,
      category,
      quantity,
      price,
      description,
      dimensions,
      weight,
      manufacturer,
      warranty_period,
      imageData,
      productId,
    ],
    (err, result) => {
      if (err) {
        console.error("Error updating product:", err);
        return res.status(500).json({ message: "Error updating product" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({ message: "Product updated successfully" });
    }
  );
};

// Delete a product
exports.deleteProduct = (req, res) => {
  const productId = req.params.id;

  // SQL queries
  const deleteCartItemsSQL = "DELETE FROM cart_items WHERE product_id = ?";
  const deleteProductSQL = "DELETE FROM products WHERE id = ?";

  // Delete related cart items first
  db.query(deleteCartItemsSQL, [productId], (err, result) => {
    if (err) {
      console.error("Error deleting related cart items:", err);
      return res
        .status(500)
        .json({ message: "Error deleting related cart items" });
    }

    // Now delete the product
    db.query(deleteProductSQL, [productId], (err, result) => {
      if (err) {
        console.error("Error deleting product:", err);
        return res.status(500).json({ message: "Error deleting product" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.status(200).json({ message: "Product deleted successfully" });
    });
  });
};
exports.calculatediscount = (req, res) => {
  const productId = req.params.productId; // Getting the product ID from the URL

  db.query(
    `SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.price AS product_price,
        p.quantity AS product_quantity,
        p.category AS product_category,
        IFNULL(SUM(oi.quantity), 0) AS total_sales
    FROM
        products p
    LEFT JOIN
        order_items oi ON p.id = oi.product_id
    LEFT JOIN
        orders o ON oi.order_id = o.id
    WHERE
        p.id = ?
    GROUP BY
        p.id`,
    [productId], // Passing the productId as an array to replace the "?"
    function (err, results) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: err.message });
      }

      if (results.length === 0) {
        console.warn("Product not found for ID:", productId);
        return res.status(404).json({ message: "Product not found" });
      }

      const product = results[0];
      const price = parseFloat(product.product_price) || 0; // Ensure price is a valid number
      const total_sales = parseInt(product.total_sales, 10) || 0;
      const category = product.product_category;

      // Debugging logs
      console.log("Retrieved product:", product);

      // Calculate discount
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

      // Log calculated values
      console.log("Discount calculation:", {
        price,
        total_sales,
        category,
        discountPercentage,
        discountAmount,
        discountedPrice,
      });

      // Return the calculated discount data
      res.json({
        product_id: productId,
        product_name: product.product_name,
        original_price: price,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount.toFixed(2),
        discounted_price: discountedPrice.toFixed(2),
      });
    }
  );
};
exports.getTopSellingProducts = async (req, res) => {
  try {
    // SQL query to get products sorted by total_quantity_sold in descending order
    const query = `
          SELECT id, name, image_data, total_quantity_sold
          FROM products
          ORDER BY total_quantity_sold DESC
      `;

    const [results] = await db.query(query);

    // Convert the image_data (LongBlob) to base64 for display
    const products = results.map((product) => ({
      ...product,
      image_data: product.image_data
        ? `data:image/jpeg;base64,${Buffer.from(product.image_data).toString(
            "base64"
          )}`
        : null,
      rating: calculateRating(product.total_quantity_sold), // Calculate star rating
    }));

    res.json(products);
  } catch (error) {
    console.error("Error fetching top-selling products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Function to calculate star rating based on total quantity sold
const calculateRating = (totalQuantitySold) => {
  if (totalQuantitySold > 8) return 5;
  if (totalQuantitySold > 6) return 4;
  if (totalQuantitySold > 4) return 3;
  if (totalQuantitySold > 2) return 2;
  return 1;
};
