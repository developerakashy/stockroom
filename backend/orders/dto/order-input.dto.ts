import { z } from "zod";
import { orderSorts, statuses } from "../../../shared/orders";

export const reference = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^ORD-[A-F0-9]{16}$/);
export const filters = z.object({
  search: z.string().trim().max(32).default(""),
  status: z.enum(statuses).optional(),
  sort: z.enum(orderSorts).optional(),
});
export const draft = z.strictObject({
  items: z
    .array(
      z.strictObject({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(9999),
      }),
    )
    .min(1)
    .max(100),
});
export const change = z.strictObject({ status: z.enum(statuses) });

export const checkoutKey = z.uuid().optional();
