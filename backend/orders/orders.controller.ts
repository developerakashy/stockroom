import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import {
  change,
  checkoutKey,
  draft,
  filters,
  reference,
} from "./dto/order-input.dto";
import type { createOrderService } from "./orders.service";

export const ORDER_SERVICE = Symbol("ORDER_SERVICE");
type OrderService = ReturnType<typeof createOrderService>;

@Controller("orders")
export class OrdersController {
  constructor(@Inject(ORDER_SERVICE) private readonly orders: OrderService) {}

  @Get()
  list(@Query(new ZodPipe(filters)) query: z.infer<typeof filters>) {
    return this.orders.list(query.search, query.status, query.sort);
  }

  @Get("counts")
  counts() {
    return this.orders.counts();
  }

  @Post()
  async place(
    @Headers("idempotency-key") key: unknown,
    @Body(new ZodPipe(draft)) input: z.infer<typeof draft>,
    @Res() reply: FastifyReply,
  ) {
    const { order, replayed } = await this.orders.place(
      input.items,
      checkoutKey.parse(key)?.toLowerCase(),
    );
    return reply
      .header("Location", `/api/orders/${order.reference}`)
      .code(replayed ? 200 : 201)
      .send(order);
  }

  @Get(":reference")
  detail(@Param("reference", new ZodPipe(reference)) orderReference: string) {
    return this.orders.detail(orderReference);
  }

  @Patch(":reference/status")
  changeStatus(
    @Param("reference", new ZodPipe(reference)) orderReference: string,
    @Body(new ZodPipe(change)) input: z.infer<typeof change>,
  ) {
    return this.orders.changeStatus(orderReference, input.status);
  }
}

@Controller("products")
export class ProductsController {
  constructor(@Inject(ORDER_SERVICE) private readonly orders: OrderService) {}

  @Get()
  catalogue() {
    return this.orders.catalogue();
  }

  @Get("recommended")
  recommendations() {
    return this.orders.recommendations();
  }
}
