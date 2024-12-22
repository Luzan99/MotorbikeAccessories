const db = require("../config/db");

// Function to get FSN analysis
const getFSNAnalysis = (req, res) => {
  const query = `
    SELECT 
      id, 
      name, 
      model, 
      total_quantity_sold,
      CASE
        WHEN total_quantity_sold > 10 THEN 'Fast-moving'
        WHEN total_quantity_sold BETWEEN 5 AND 10 THEN 'Slow-moving'
        WHEN total_quantity_sold < 5 THEN 'Non-moving'
        ELSE 'Undefined'
      END AS sales_category
    FROM products
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database query failed" });
    }
    return res.status(200).json({ data: results });
  });
};

module.exports = { getFSNAnalysis };
