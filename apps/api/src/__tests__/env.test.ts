import { describe, expect, it } from "vitest";
import { assertProductionSecrets, getJwtSecret } from "../lib/env.js";

describe("env", () => {
  it("uses dev jwt secret outside production", () => {
    expect(getJwtSecret()).toBeTruthy();
  });

  it("throws when production uses default jwt secret", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousJwtSecret = process.env.JWT_SECRET;

    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    expect(() => assertProductionSecrets()).toThrow("JWT_SECRET");

    process.env.NODE_ENV = previousNodeEnv;
    if (previousJwtSecret) {
      process.env.JWT_SECRET = previousJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });
});
