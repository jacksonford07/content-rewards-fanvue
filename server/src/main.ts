import { NestFactory } from "@nestjs/core";
import { json } from "express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", true);

  app.use(json({ limit: "10mb" }));
  app.setGlobalPrefix("api");

  // Fanvue OAuth callback is registered without /api prefix,
  // so proxy /auth/fanvue/callback → /api/auth/fanvue/callback
  expressApp.get("/auth/fanvue/callback", (req: any, res: any) => {
    const qs = new URLSearchParams(req.query).toString();
    res.redirect(307, `/api/auth/fanvue/callback?${qs}`);
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  app.enableCors({ origin: frontendUrl, credentials: true });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Server running on http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
