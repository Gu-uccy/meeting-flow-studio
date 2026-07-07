const DEV_JWT_SECRET = "meeting-flow-dev-secret-change-in-production";

export function getJwtSecret() {
  return process.env["JWT_SECRET"] ?? DEV_JWT_SECRET;
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (getJwtSecret() === DEV_JWT_SECRET) {
    throw new Error("生产环境必须设置 JWT_SECRET，不能使用默认值");
  }
}

export function isSchedulerEnabled() {
  return process.env["SCHEDULER_ENABLED"] !== "false";
}
