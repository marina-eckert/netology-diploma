import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { Controller, Get, Module } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import session from "express-session";
import passport from "passport";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseModule } from "./database.js";
import {
  AuthModule,
  UsersModule,
  UsersService,
  configurePassport,
} from "./auth.js";
import { LibrariesModule } from "./catalog.js";
import { RentalsModule } from "./rentals.js";
import { SupportModule } from "./support.js";
@Controller("api/health")
class HealthController {
  @Get() check() {
    return { status: "ok" };
  }
}
@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    UsersModule,
    AuthModule,
    LibrariesModule,
    RentalsModule,
    SupportModule,
  ],
})
class AppModule {}
async function bootstrap() {
  mkdirSync("uploads", { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable("x-powered-by");
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32))
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  const sessions = session({
    name: "library.sid",
    secret: secret || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 86400000,
    },
  });
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  configurePassport(app.get(UsersService));
  app.use(sessions, passport.initialize(), passport.session());
  let disconnectSession = (_sessionId: string) => {};
  const loginAttempts = new Map<string, { count: number; until: number }>();
  app.use((req: any, res: any, next: any) => {
    const routePath = req.path.replace(/\/+$/, "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (routePath === "/api/auth/logout" && req.method === "POST") {
      const sessionId = req.sessionID;
      res.once("finish", () => {
        if (res.statusCode < 400) disconnectSession(sessionId);
      });
    }
    if (
      ["POST", "PATCH", "DELETE", "PUT"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return res
            .status(403)
            .json({ message: "Запрос с другого сайта запрещён" });
      } catch {
        return res.sendStatus(403);
      }
    }
    if (req.path.startsWith("/api/admin/") && req.user?.role !== "admin")
      return res
        .status(req.user ? 403 : 401)
        .json({ message: "Требуются права администратора" });
    if (routePath === "/api/auth/login" && req.method === "POST") {
      const key = req.ip;
      const now = Date.now();
      let item = loginAttempts.get(key);
      if (!item || now > item.until) {
        item = { count: 0, until: now + 60000 };
        loginAttempts.set(key, item);
      }
      if (++item.count > 20)
        return res
          .status(429)
          .json({ message: "Слишком много попыток. Подождите минуту." });
      if (loginAttempts.size > 10000)
        for (const [k, v] of loginAttempts)
          if (v.until < now) loginAttempts.delete(k);
    }
    next();
  });
  app.useStaticAssets(resolve("uploads"), {
    prefix: "/uploads/",
  });
  app.useStaticAssets(resolve("dist"));
  app.use((req: any, res: any, next: any) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api/") &&
      !req.path.startsWith("/uploads/") &&
      !req.path.startsWith("/socket.io/")
    )
      return res.sendFile(resolve("dist/index.html"));
    next();
  });
  // Register security and static middleware before Nest installs its 404 handler.
  await app.init();
  const { SupportGateway } = await import("./support.js");
  const gateway = app.get(SupportGateway);
  disconnectSession = (sessionId: string) => {
    for (const socket of gateway.server.sockets.sockets.values()) {
      if ((socket.request as any).sessionID === sessionId)
        socket.disconnect(true);
    }
  };
  gateway.server.engine.use(sessions as any);
  gateway.server.engine.use(passport.initialize());
  gateway.server.engine.use(passport.session());
  await app.listen(
    Number(process.env.HTTP_PORT || process.env.PORT || 3000),
    process.env.HTTP_HOST ||
      (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  );
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
