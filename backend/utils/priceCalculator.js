// Utility function to calculate the total price of items in the cart
exports.calculateTotalPrice = (cartItems) => {
  return cartItems.reduce((total, item) => {
    return total + item.quantity * item.price;
  }, 0);
};
