
import "dotenv/config";
import { pool } from "../config/database.js";
import { getOrderStatus } from "../services/order.service.js";

async function main() {
  try {
    const order = await getOrderStatus("12345");

    if (!order) {
      console.log("Order not found");
      return;
    }

    console.log("Order details:");
    console.log(order);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

main();
