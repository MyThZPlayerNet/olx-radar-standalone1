import { getDatabase, type DatabaseLike } from "@/lib/database";

export type AppEnv = {
  ADMIN_DISPLAY_NAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_USERNAME?: string;
  APP_ENCRYPTION_KEY?: string;
  DB: DatabaseLike;
};

export function getAppEnv(): AppEnv {
  return {
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
    DB: getDatabase(),
  };
}
