import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const DB = Symbol("DB");
export type Database = NeonHttpDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Database => {
        const sql = neon(config.getOrThrow<string>("DATABASE_URL"));
        return drizzle(sql, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
