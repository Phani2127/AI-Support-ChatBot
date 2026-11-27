INSERT INTO orders (order_number, customer_name, status, total_amount)
VALUES
  ('12345', 'John', 'Shipped', 1500.00),
  ('12346', 'Alice', 'Processing', 2500.00),
  ('12347', 'David', 'Delivered', 999.00)
ON CONFLICT (order_number) DO NOTHING;
