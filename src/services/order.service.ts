
import { pool } from "../config/database.js";

export interface Order {
  order_number: string;
  customer_name: string;
  status: string;
  total_amount: string;
}

export async function getOrderStatus(
  orderNumber: string
): Promise<Order | null> {

  const result = await pool.query(
    `
    SELECT
      order_number,
      customer_name,
      status,
      total_amount
    FROM orders
    WHERE order_number = $1
    LIMIT 1
    `,
    [orderNumber]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Order;
}
