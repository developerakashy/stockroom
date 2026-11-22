import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { HttpErrorFilter } from "./common/http-error.filter";
import {
  OrdersController,
  ProductsController,
} from "./orders/orders.controller";

@Module({
  controllers: [OrdersController, ProductsController],
  providers: [{ provide: APP_FILTER, useClass: HttpErrorFilter }],
})
export class AppModule {}
