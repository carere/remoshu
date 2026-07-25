import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const token = "moon-e2e-token";
const port = Number(process.env.REMOSHU_E2E_PORT ?? "18791");
const host = `http://127.0.0.1:${port}`;
const workspace = await mkdtemp(join(tmpdir(), "remoshu-moon-e2e-"));

const run = async (command: string[], cwd: string, env?: Record<string, string>) => {
  const process = Bun.spawn(command, {
    cwd,
    env: { ...Bun.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed\n${stdout}\n${stderr}`);
  }
  return { stdout, stderr };
};

const worker = Bun.spawn(
  [
    "bunx",
    "wrangler",
    "dev",
    "--local",
    "--port",
    String(port),
    "--persist-to",
    join(workspace, "r2-state"),
    "--var",
    `CACHE_TOKEN:${token}`,
    "--log-level",
    "error",
  ],
  {
    cwd: root,
    stdout: "ignore",
    stderr: "inherit",
  },
);

try {
  await cp(join(root, "tests/e2e/fixture"), workspace, { recursive: true });
  const workspaceConfigPath = join(workspace, ".moon/workspace.yml");
  const workspaceConfig = await readFile(workspaceConfigPath, "utf8");
  await writeFile(workspaceConfigPath, workspaceConfig.replace("__REMOTE_HOST__", host));

  await run(["git", "init", "--initial-branch=main"], workspace);
  await run(["git", "add", "."], workspace);
  await run(
    [
      "git",
      "-c",
      "user.name=Remoshu",
      "-c",
      "user.email=remoshu@example.invalid",
      "commit",
      "-m",
      "fixture",
    ],
    workspace,
  );

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${host}/status`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Workerd is still starting.
    }
    await Bun.sleep(100);
  }
  if (!ready) {
    throw new Error("The local Worker did not become ready");
  }

  const moonEnv = { MOON_REMOTE_CACHE_TOKEN: token };
  await run(["moon", "run", "fixture:build"], workspace, moonEnv);
  const firstExecution = await readFile(join(workspace, "execution.log"), "utf8");
  if (firstExecution !== "run\n") {
    throw new Error(`Expected one task execution, received ${JSON.stringify(firstExecution)}`);
  }

  await rm(join(workspace, "dist"), { recursive: true, force: true });
  await rm(join(workspace, ".moon/cache"), { recursive: true, force: true });

  await run(["moon", "run", "fixture:build"], workspace, moonEnv);
  const [secondExecution, restoredOutput] = await Promise.all([
    readFile(join(workspace, "execution.log"), "utf8"),
    readFile(join(workspace, "dist/output.txt"), "utf8"),
  ]);
  if (secondExecution !== "run\n") {
    throw new Error("The second moon run executed the task instead of restoring it");
  }
  if (restoredOutput !== "restored from the remote cache\n") {
    throw new Error("The restored output did not match the original artifact");
  }

  console.log("moon restored the task output from the remote R2 cache");
} finally {
  worker.kill();
  await worker.exited;
  await rm(workspace, { recursive: true, force: true });
}
