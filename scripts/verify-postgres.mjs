import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(repoRoot, "apps", "api");
const requireFromApi = createRequire(path.join(apiRoot, "package.json"));
const composeFile = path.join(repoRoot, "docker-compose.postgres.yml");
const defaultDatabaseUrl = "postgresql://meeting_flow:meeting_flow@127.0.0.1:5433/meeting_flow";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      stdio: options.stdio ?? "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function commandExists(command) {
  try {
    await run(command, ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function startDockerPostgres() {
  const docker = (await commandExists("docker")) ? "docker" : null;
  if (!docker) {
    throw new Error("Docker CLI not found");
  }

  console.log("Starting PostgreSQL via Docker Compose...");
  await run(docker, ["compose", "-f", composeFile, "up", "-d", "--wait"]);
  return {
    databaseUrl: defaultDatabaseUrl,
    async stop() {
      console.log("Stopping PostgreSQL container...");
      await run(docker, ["compose", "-f", composeFile, "down", "-v"]);
    }
  };
}

async function startEmbeddedPostgres() {
  const embeddedPostgresPath = pathToFileURL(requireFromApi.resolve("embedded-postgres")).href;
  const module = await import(embeddedPostgresPath);
  const EmbeddedPostgres = module.default;
  const dataDir = path.join(apiRoot, ".tmp", `embedded-postgres-${Date.now()}`);
  const port = 55433;
  console.log("Docker unavailable, starting embedded PostgreSQL...");

  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "meeting_flow",
    password: "meeting_flow",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {}
  });

  await postgres.initialise();
  await postgres.start();

  const databaseUrl = `postgresql://${encodeURIComponent("meeting_flow")}:${encodeURIComponent("meeting_flow")}@127.0.0.1:${port}/postgres`;

  return {
    databaseUrl,
    async stop() {
      console.log("Stopping embedded PostgreSQL...");
      await postgres.stop();
    }
  };
}

async function main() {
  let runtime;

  try {
    runtime = await startDockerPostgres();
  } catch (dockerError) {
    console.warn(`Docker startup failed: ${dockerError instanceof Error ? dockerError.message : String(dockerError)}`);
    runtime = await startEmbeddedPostgres();
  }

  console.log(`Using DATABASE_URL=${runtime.databaseUrl}`);

  try {
    await run("pnpm", ["--filter", "@meeting-flow/api", "test:postgres"], {
      env: {
        RUN_POSTGRES_TESTS: "true",
        DB_DRIVER: "postgres",
        DATABASE_URL: runtime.databaseUrl
      }
    });
    console.log("PostgreSQL verification passed.");
  } finally {
    await runtime.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
