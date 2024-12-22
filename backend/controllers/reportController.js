const db = require("../config/db");

// Get total quantity sold per product
exports.getProductSalesReport = (req, res) => {
  const query = `
        SELECT 
            p.id AS product_id,
            p.name AS product_name,
            p.category,
            SUM(oi.quantity) AS total_quantity_sold,
            SUM(oi.quantity * oi.price) AS total_revenue
        FROM 
            products p
        LEFT JOIN 
            order_items oi ON p.id = oi.product_id
        LEFT JOIN 
            orders o ON oi.order_id = o.id
        WHERE 
            o.status = 'completed'
        GROUP BY 
            p.id
        ORDER BY 
            total_quantity_sold DESC;
    `;

  db.query(query, (error, results) => {
    if (error) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.status(200).json({ success: true, data: results });
    }
  });
};

// Get sales over time
exports.getSalesOverTime = (req, res) => {
  const query = `
        SELECT 
            DATE(o.created_at) AS sale_date,
            SUM(oi.quantity) AS total_quantity_sold,
            SUM(oi.quantity * oi.price) AS total_revenue
        FROM 
            orders o
        LEFT JOIN 
            order_items oi ON o.id = oi.order_id
        WHERE 
            o.status = 'completed'
        GROUP BY 
            sale_date
        ORDER BY 
            sale_date ASC;
    `;

  db.query(query, (error, results) => {
    if (error) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.status(200).json({ success: true, data: results });
    }
  });
};
