const db = require("../config/db");
const regression = require("regression");

exports.predictSalesUsingSMA = (req, res) => {
  const currentDate = new Date();
  const firstDayOfCurrentWeek = currentDate.getDate() - currentDate.getDay();
  const lastDayOfLastWeek = new Date(currentDate);
  lastDayOfLastWeek.setDate(firstDayOfCurrentWeek - 1);

  const firstDayOfTwoWeeksAgo = new Date(currentDate);
  firstDayOfTwoWeeksAgo.setDate(firstDayOfCurrentWeek - 14);

  // Query to fetch sales data for the last two weeks
  const query = `
        SELECT p.id, p.name, SUM(oi.quantity) AS total_quantity_sold, YEAR(o.created_at) AS year, WEEK(o.created_at) AS week
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at BETWEEN ? AND ?
        GROUP BY p.id, YEAR(o.created_at), WEEK(o.created_at)
      `;

  db.query(
    query,
    [firstDayOfTwoWeeksAgo, lastDayOfLastWeek],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to fetch sales data" });
      }

      // Group sales data by product_id
      const salesData = {};
      results.forEach((item) => {
        if (!salesData[item.id]) {
          salesData[item.id] = {
            product_name: item.name,
            weekly_sales: [],
          };
        }

        salesData[item.id].weekly_sales.push(item.total_quantity_sold);
      });

      // Predict next week's sales using the moving average
      const predictedSales = Object.keys(salesData)
        .filter((productId) => salesData[productId].weekly_sales.length >= 2) // Ensure at least 2 weeks of data
        .map((productId) => {
          const data = salesData[productId];
          const averageSales =
            data.weekly_sales.reduce((acc, curr) => acc + curr, 0) /
            data.weekly_sales.length;
          return {
            product_name: data.product_name,
            predicted_sales_next_week: Math.round(averageSales),
          };
        });

      return res.status(200).json(predictedSales);
    }
  );
};

exports.predictSalesUsingEMA = (req, res) => {
  const currentDate = new Date();
  const firstDayOfCurrentWeek = currentDate.getDate() - currentDate.getDay();
  const lastDayOfLastWeek = new Date(currentDate);
  lastDayOfLastWeek.setDate(firstDayOfCurrentWeek - 1);

  const firstDayOfTwoWeeksAgo = new Date(currentDate);
  firstDayOfTwoWeeksAgo.setDate(firstDayOfCurrentWeek - 14);

  // Query to fetch sales data for the last two weeks
  const query = `
      SELECT p.id, p.name, SUM(oi.quantity) AS total_quantity_sold, WEEK(o.created_at) AS week
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at BETWEEN ? AND ?
      GROUP BY p.id, WEEK(o.created_at)
      ORDER BY p.id, WEEK(o.created_at)
    `;

  db.query(
    query,
    [firstDayOfTwoWeeksAgo, lastDayOfLastWeek],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to fetch sales data" });
      }

      // Organize data by product
      const salesData = {};
      results.forEach((item) => {
        if (!salesData[item.id]) {
          salesData[item.id] = {
            product_name: item.name,
            weekly_sales: [],
          };
        }

        salesData[item.id].weekly_sales.push(item.total_quantity_sold);
      });

      // Apply EMA formula (with smoothing factor α = 0.3)
      const alpha = 0.3;
      const predictedSales = Object.keys(salesData)
        .filter((productId) => salesData[productId].weekly_sales.length >= 2) // Ensure at least 2 weeks of data
        .map((productId) => {
          const data = salesData[productId];
          let ema = data.weekly_sales[0]; // Initial EMA is the first week's sales

          // Calculate EMA for subsequent weeks
          data.weekly_sales.slice(1).forEach((sale) => {
            ema = alpha * sale + (1 - alpha) * ema;
          });

          return {
            product_name: data.product_name,
            predicted_sales_next_week: Math.round(ema),
          };
        });

      return res.status(200).json(predictedSales);
    }
  );
};

exports.predictSalesUsingLinearRegression = (req, res) => {
  const currentDate = new Date();
  const firstDayOfCurrentWeek = currentDate.getDate() - currentDate.getDay();
  const lastDayOfLastWeek = new Date(currentDate);
  lastDayOfLastWeek.setDate(firstDayOfCurrentWeek - 1);

  const firstDayOfTwoWeeksAgo = new Date(currentDate);
  firstDayOfTwoWeeksAgo.setDate(firstDayOfCurrentWeek - 14);

  const query = `
    SELECT p.id, p.name, SUM(oi.quantity) AS total_quantity_sold, p.price
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at BETWEEN ? AND ?
    GROUP BY p.id
  `;

  db.query(
    query,
    [firstDayOfTwoWeeksAgo, lastDayOfLastWeek],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to fetch sales data" });
      }

      // Prepare data for Linear Regression
      const inputs = [];
      const outputs = [];

      results.forEach((item) => {
        const quantity = parseInt(item.total_quantity_sold);
        const price = parseFloat(item.price);

        if (!isNaN(quantity) && !isNaN(price) && quantity > 0 && price > 0) {
          const normalizedQuantity =
            quantity / Math.max(...results.map((r) => r.total_quantity_sold));
          const normalizedPrice =
            price / Math.max(...results.map((r) => r.price));

          inputs.push([normalizedQuantity, normalizedPrice]);
          outputs.push(Math.log(quantity));
        }
      });

      if (inputs.length < 2) {
        return res
          .status(400)
          .json({ error: "Insufficient valid data for regression" });
      }

      const data = inputs.map((input, index) => [...input, outputs[index]]);
      const result = regression.polynomial(data, { order: 2 });

      const predictedSales = results
        .filter((item) => !isNaN(item.total_quantity_sold)) // Ensure data validity
        .map((item) => {
          const prediction =
            result.equation[0] *
              Math.pow(
                item.total_quantity_sold /
                  Math.max(...results.map((r) => r.total_quantity_sold)),
                2
              ) +
            result.equation[1] *
              (item.total_quantity_sold /
                Math.max(...results.map((r) => r.total_quantity_sold))) +
            result.equation[2] *
              (item.price / Math.max(...results.map((r) => r.price)));

          const predictedSales = Math.exp(prediction);

          return {
            product_name: item.name,
            predicted_sales_next_week: Math.round(predictedSales),
          };
        });

      return res.status(200).json(predictedSales);
    }
  );
};
