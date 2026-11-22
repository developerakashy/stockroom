import "reflect-metadata";
import fastifyStatic from "@fastify/static";
import { BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import type { Store } from "./db/client";
import { ORDER_SERVICE } from "./orders/orders.controller";
import { createOrderService } from "./orders/orders.service";

export async function createApp(db: Store, staticDirectory?: string) {
  const bodyLimit = 32 * 1024;
  const adapter = new FastifyAdapter({
    bodyLimit,
    routerOptions: { ignoreTrailingSlash: true, caseSensitive: false },
  });
  const fastify = adapter.getInstance();
  fastify.addHook("onRequest", (request, reply, done) => {
    if (/^\/api(?:\/|\?|$)/i.test(request.url)) {
      reply.header("Cache-Control", "no-store");
    }
    done();
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    {
      module: AppModule,
      providers: [
        { provide: ORDER_SERVICE, useFactory: () => createOrderService(db) },
      ],
    },
    adapter,
    { abortOnError: false, bodyParser: false, logger: ["error", "warn"] },
  );

  app.setGlobalPrefix("api");

  // Keep Fastify's safe parser and preserve its error code through Nest's filter.
  const parseJson = fastify.getDefaultJsonParser("error", "error");
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      parseJson(request, body.toString(), (error, parsed) => {
        done(
          error
            ? new BadRequestException("Invalid JSON", { cause: error })
            : null,
          parsed,
        );
      });
    },
  );

  if (staticDirectory) {
    fastify.register(fastifyStatic, {
      root: staticDirectory,
      wildcard: false,
      index: false,
    });
    for (const path of [
      "/",
      "/orders",
      "/orders/:reference",
      "/products",
      "/products/:sku",
      "/cart",
    ]) {
      fastify.get(path, (_request, reply) => reply.sendFile("index.html"));
    }
  }

  try {
    await app.init();
    await fastify.ready();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
