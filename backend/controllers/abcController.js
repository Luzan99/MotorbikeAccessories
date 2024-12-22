const db = require("../config/db");

// Function to fetch product sales data
const getProductSales = async () => {
  const query = `
    SELECT p.id, p.name, p.price, p.quantity, p.total_quantity_sold, 
           SUM(oi.quantity * oi.price) AS total_sales,p.image_data
    FROM products p
    LEFT JOIN order_items oi ON p.id = oi.product_id
    GROUP BY p.id
    ORDER BY total_sales DESC;
  `;
  try {
    const result = await new Promise((resolve, reject) => {
      db.query(query, (err, rows, fields) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Convert image blob to base64
    result.forEach((product) => {
      if (product.image_data) {
        product.image_url = `data:image/jpeg;base64,${product.image_data.toString(
          "base64"
        )}`;
      } else {
        product.image_url = null;
      }
    });

    return result;
  } catch (err) {
    console.error(err);
    throw new Error("Error fetching product sales data");
  }
};

const calculateABC = (products) => {
  // Ensure total sales is calculated properly
  let totalSales = products.reduce((acc, product) => {
    const sales = parseFloat(product.total_sales) || 0; // Default to 0 if invalid
    return acc + sales;
  }, 0);

  console.log("Total Sales: ", totalSales);

  let cumulativeSales = 0;
  let classification = {
    A: [],
    B: [],
    C: [],
  };

  // Sort products by total_sales in descending order
  products.sort((a, b) => b.total_sales - a.total_sales);

  products.forEach((product) => {
    const sales = parseFloat(product.total_sales) || 0; // Default to 0
    cumulativeSales += sales;
    let salesPercentage =
      totalSales > 0 ? (cumulativeSales / totalSales) * 100 : 0;

    // Debug logs for classification
    console.log(
      `Product: ${product.name}, Cumulative Sales: ${cumulativeSales}, Sales Percentage: ${salesPercentage}%`
    );

    if (salesPercentage <= 80) {
      classification.A.push(product);
    } else if (salesPercentage <= 95) {
      classification.B.push(product);
    } else {
      classification.C.push(product);
    }
  });

  return classification;
};

exports.getABCAnalysis = async (req, res) => {
  try {
    const products = await getProductSales();
    const abcClassification = calculateABC(products);
    res.json(abcClassification);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error calculating ABC analysis");
  }
};
