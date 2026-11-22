import assert from "node:assert/strict";
import { Client } from "pg";

export async function verifyDatabaseGuardrails(
  databaseUrl: string,
  productId: number,
  reference: string,
  checkoutKey: string,
) {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const {
      rows: [before],
    } = await client.query<{ stock: string }>(
      "select stock from products where id = $1",
      [productId],
    );
    assert.ok(before);

    await client.query("begin");
    try {
      await client.query(
        "update products set stock = stock - 1 where id = $1",
        [productId],
      );
      await assert.rejects(
        client.query("update products set stock = -1 where id = $1", [
          productId,
        ]),
        { code: "23514", constraint: "stock_nonnegative" },
      );
      // PostgreSQL refuses even a valid statement in the failed transaction.
      await assert.rejects(client.query("select 1"), { code: "25P02" });
    } finally {
      await client.query("rollback");
    }

    const {
      rows: [after],
    } = await client.query<{ stock: string }>(
      "select stock from products where id = $1",
      [productId],
    );
    assert.deepEqual(after, before, "The earlier valid debit was rolled back");

    await assert.rejects(
      client.query(
        "update orders set status = 'Invalid' where reference = $1",
        [reference],
      ),
      { code: "23514", constraint: "valid_status" },
    );
    await assert.rejects(
      client.query(
        "insert into orders (reference, status, total_cents, created_at, placement_key) values ($1, 'Placed', 0, $2, $3)",
        ["ORD-0000000000000001", new Date().toISOString(), checkoutKey],
      ),
      { code: "23505", constraint: "orders_placement_key" },
    );
    await assert.rejects(
      client.query(
        "insert into order_items (order_reference, product_id, name, quantity, unit_price_cents) values ($1, $2, 'Invalid line', 1, 100)",
        ["ORD-0000000000000001", productId],
      ),
      {
        code: "23503",
        constraint: "order_items_order_reference_orders_reference_fk",
      },
    );
    await assert.rejects(
      client.query(
        "update order_items set quantity = 0 where order_reference = $1 and product_id = $2",
        [reference, productId],
      ),
      { code: "23514", constraint: "quantity_positive" },
    );

    const {
      rows: [server],
    } = await client.query<{ version: string }>(
      "select current_setting('server_version') as version",
    );
    return server.version;
  } finally {
    await client.end();
  }
}
