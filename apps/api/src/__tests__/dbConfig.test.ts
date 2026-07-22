import { describe, expect, it } from "vitest";
import { assertDatabaseConfig, getDatabaseConfig } from "../lib/db/config.js";

describe("database config", () => {
  it("defaults to sqlite driver", () => {
    const config = getDatabaseConfig();
    expect(config.driver).toBe("sqlite");
    expect(config.sqlitePath).toContain("meetings.db");
  });

  it("requires DATABASE_URL for postgres in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDriver = process.env.DB_DRIVER;
    const previousDatabaseUrl = process.env.DATABASE_URL;

    process.env.NODE_ENV = "production";
    process.env.DB_DRIVER = "postgres";
    delete process.env.DATABASE_URL;

    expect(() => assertDatabaseConfig()).toThrow("DATABASE_URL");

    process.env.NODE_ENV = previousNodeEnv;
    if (previousDriver) {
      process.env.DB_DRIVER = previousDriver;
    } else {
      delete process.env.DB_DRIVER;
    }
    if (previousDatabaseUrl) {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
