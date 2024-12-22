const db = require("../config/db");

// Helper function to calculate similarity between products
const calculateSimilarity = (product, targetProduct) => {
  // Compare category, manufacturer, etc.
  let score = 0;
  if (product.category === targetProduct.category) score += 1;
  if (product.manufacturer === targetProduct.manufacturer) score += 1;
  const priceDifference = Math.abs(product.price - targetProduct.price);
  if (priceDifference <= 50) {
    score += 1;
  }
  // Additional conditions for similarity
  if (
    product.price >= targetProduct.price * 0.8 &&
    product.price <= targetProduct.price * 1.2
  )
    score += 0.5; // Similar price range

  return score;
};

exports.getRecommendedProducts = (req, res) => {
  const productId = req.params.id;

  // Fetch the target product
  const targetProductSQL = "SELECT * FROM products WHERE id = ?";
  db.query(targetProductSQL, [productId], (err, targetResults) => {
    if (err) {
      console.error("Error fetching target product:", err);
      return res.status(500).json({ message: "Error fetching target product" });
    }

    if (targetResults.length === 0) {
      return res.status(404).json({ message: "Target product not found" });
    }

    const targetProduct = targetResults[0];

    // Fetch all other products
    const allProductsSQL = "SELECT * FROM products WHERE id != ?";
    db.query(allProductsSQL, [productId], (err, allResults) => {
      if (err) {
        console.error("Error fetching products:", err);
        return res.status(500).json({ message: "Error fetching products" });
      }

      // Process image_data and calculate similarity
      const recommendations = allResults
        .map((product) => {
          const imageBase64 = product.image_data
            ? Buffer.from(product.image_data).toString("base64")
            : null;

          return {
            ...product,
            image_data: imageBase64, // Convert image_data to Base64
            similarity: calculateSimilarity(product, targetProduct),
          };
        })
        .filter((product) => product.similarity > 0) // Exclude products with no similarity
        .sort((a, b) => b.similarity - a.similarity) // Sort by similarity score
        .slice(0, 5); // Limit to top 5 recommendations

      res.json(recommendations);
    });
  });
};

exports.getRecommendations = (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is missing" });
  }

  // Step 1: Get user's interactions (wishlist)
  const userInteractionsQuery = `
      SELECT product_id
      FROM wishlist
      WHERE user_id = ?
  `;

  db.execute(userInteractionsQuery, [userId], (err, userInteractions) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!userInteractions || userInteractions.length === 0) {
      return res.status(200).json({ recommendations: [] });
    }

    // Step 2: Get similar users who interacted with the same products
    const productIds = userInteractions.map(
      (interaction) => interaction.product_id
    );
    const productIdList = productIds.join(",");

    const similarUsersQuery = `
          SELECT user_id FROM wishlist WHERE product_id IN (${productIdList})
          UNION
          SELECT user_id FROM order_items WHERE product_id IN (${productIdList})
          AND user_id != ?;
      `;

    db.execute(similarUsersQuery, [userId], (err, similarUsers) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      const similarUserIds = similarUsers.map((user) => user.user_id);
      if (similarUserIds.length === 0) {
        return res.status(200).json({ recommendations: [] });
      }

      // Step 3: Get recommended products based on similar users' interactions
      const recommendedProductsQuery = `
              SELECT DISTINCT p.id, p.name, p.price, p.category, p.image_data,
              IFNULL(SUM(oi.quantity), 0) AS total_sales
              FROM products p
              LEFT JOIN order_items oi ON p.id = oi.product_id
              WHERE oi.user_id IN (${similarUserIds.join(",")})
              OR p.id IN (
                SELECT product_id FROM wishlist WHERE user_id IN (${similarUserIds.join(
                  ","
                )})
              )
              GROUP BY p.id;
          `;

      db.execute(recommendedProductsQuery, (err, recommendedProducts) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Internal Server Error" });
        }

        // Process each product to calculate discounts and prepare the response
        const recommendationsWithDiscounts = recommendedProducts.map(
          (product) => {
            const price = parseFloat(product.price) || 0;
            const totalSales = parseInt(product.total_sales, 10) || 0;
            const category = product.category;

            // Discount logic
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

            // Process image_data and convert to Base64
            const imageBase64 = product.image_data
              ? Buffer.from(product.image_data).toString("base64")
              : null;

            return {
              id: product.id,
              name: product.name,
              original_price: price,
              discounted_price: discountedPrice.toFixed(2),
              discount_percentage: discountPercentage,
              image_data: imageBase64, // Convert image_data to Base64
            };
          }
        );

        res.status(200).json({ recommendations: recommendationsWithDiscounts });
      });
    });
  });
};
