import { chromium } from "playwright";

const baseUrl = process.env.WEB_URL ?? "http://127.0.0.1:5173";
const email = process.env.E2E_EMAIL ?? "editor@meetingflow.local";
const password = process.env.E2E_PASSWORD ?? "admin123";

const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step}${detail ? ` — ${detail}` : ""}`);
}

async function assertVisible(page, locator, step) {
  const visible = await locator.first().isVisible().catch(() => false);
  if (visible) {
    pass(step);
    return true;
  }
  fail(step, "元素不可见");
  return false;
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const loginForm = page.locator(".auth-page--login");
  await loginForm.getByPlaceholder("admin@meetingflow.local").fill(email);
  await loginForm.getByLabel("密码").fill(password);
  await loginForm.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForSelector('[data-testid="workbench-app"]', { timeout: 20000 });
  return assertVisible(page, page.getByTestId("workbench-app"), "登录并进入工作台");
}

async function ensureMeetingSelected(page) {
  // Prefer meeting overview browser cards; fall back to top selector.
  await page.getByTestId("nav-meeting").click();
  await page.waitForTimeout(400);

  const cards = page.locator("[data-testid='meeting-browser-grid'] .meeting-card");
  if ((await cards.count()) > 0) {
    await cards.first().click();
    await page.waitForTimeout(400);
  }

  await page.getByTestId("nav-workspace").click();
  await page.waitForTimeout(500);

  const editorVisible = await page.locator(".workflow-editor").first().isVisible().catch(() => false);
  if (editorVisible) {
    pass("选择会议并加载流程画布");
    return true;
  }

  const selector = page.getByTestId("meeting-selector");
  if (await selector.isVisible().catch(() => false)) {
    pass("顶栏会议选择器可见");
    return true;
  }

  fail("选择会议并加载流程画布", "未找到会议卡片或流程编辑器");
  return false;
}

async function openSidebarView(page, view, expectedLocator) {
  const navButton = page.getByTestId(`nav-${view}`);
  if (!(await navButton.isVisible().catch(() => false))) {
    fail(`切换到「${view}」`, "侧栏按钮不可见");
    return false;
  }
  await navButton.click();
  await page.waitForTimeout(500);
  return assertVisible(page, page.locator(expectedLocator), `切换到「${view}」`);
}

async function testWorkflowEditor(page) {
  await openSidebarView(page, "workspace", ".workflow-editor, #workflow-console");
  await assertVisible(page, page.getByTestId("model-runtime-badge"), "模型运行态徽章");
  await assertVisible(page, page.getByTestId("workflow-run"), "流程运行按钮");
  await assertVisible(page, page.getByTitle("添加节点"), "编辑操作「添加节点」");
  await assertVisible(page, page.getByTitle("保存"), "编辑操作「保存」");
}

async function testWorkflowRunLifecycle(page) {
  const startButton = page.getByTestId("workflow-run");
  if (!(await startButton.isVisible().catch(() => false))) {
    fail("启动流程并等待完成", "运行按钮不可见");
    return;
  }

  if (await startButton.isDisabled().catch(() => false)) {
    fail("启动流程并等待完成", "运行按钮不可用");
    return;
  }

  const token = await page.evaluate(() => localStorage.getItem("meeting_flow_token") ?? "");
  const buttonLabel = ((await startButton.innerText().catch(() => "")) || "").trim();
  // “继续” = advance blocked run; otherwise start a new run (failed runs no longer masquerade as continue).
  const useAdvance = buttonLabel.includes("继续");

  const responsePromise = page.waitForResponse(
    (response) => {
      const url = response.url();
      const method = response.request().method();
      if (!url.includes("/api/workflows/runs")) {
        return false;
      }
      if (useAdvance) {
        return method === "PATCH" && url.includes("/advance");
      }
      return method === "POST" && !url.includes("/retry") && !url.includes("/advance");
    },
    { timeout: 15000 }
  );

  await startButton.click();

  let startedRunId = null;
  try {
    const response = await responsePromise;
    if (!response.ok()) {
      const body = await response.json().catch(() => ({}));
      fail("启动流程并等待完成", body.message ?? `HTTP ${response.status()}`);
      return;
    }
    const body = await response.json();
    startedRunId = body.run?.id ?? null;
    if (!startedRunId) {
      fail("启动流程并等待完成", "响应缺少 run.id");
      return;
    }
  } catch (error) {
    fail("启动流程并等待完成", `未捕获到启动请求：${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const startedAt = Date.now();
  let finalStatus = null;
  let lastDetail = "";

  while (Date.now() - startedAt < 45000) {
    const snapshot = await page.evaluate(
      async ({ authToken, runId }) => {
        const response = await fetch(`/api/workflows/runs/${runId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) {
          return { ok: false, detail: `HTTP ${response.status}` };
        }
        const data = await response.json();
        const status = data.run?.status;
        if (!status) {
          return { ok: false, detail: "响应缺少 status" };
        }
        if (status === "running" || status === "queued") {
          return { ok: true, pending: true, detail: `运行中 ${status}` };
        }
        return { ok: true, pending: false, status };
      },
      { authToken: token, runId: startedRunId }
    );

    if (!snapshot.ok) {
      lastDetail = snapshot.detail ?? "查询失败";
      break;
    }
    if (!snapshot.pending) {
      finalStatus = snapshot.status;
      break;
    }
    lastDetail = snapshot.detail ?? "";
    await page.waitForTimeout(500);
  }

  if (!finalStatus) {
    fail("启动流程并等待完成", lastDetail || "等待超时");
    return;
  }

  if (["completed", "blocked", "failed"].includes(String(finalStatus))) {
    pass("启动流程并等待完成", `最终状态 ${finalStatus}${useAdvance ? "（继续）" : ""}`);
  } else {
    fail("启动流程并等待完成", `意外状态 ${finalStatus}`);
  }
}

async function testMeetingViews(page) {
  await openSidebarView(page, "meeting", ".meeting-overview, [data-testid='meeting-browser']");
  await assertVisible(page, page.getByTestId("meeting-browser"), "会议页浏览区");
  await openSidebarView(page, "chat", ".chat-page, .workbench-empty");
  await openSidebarView(page, "knowledge", ".knowledge-page, .workbench-empty");
}

async function testNavViews(page) {
  const appsNav = page.getByTestId("nav-apps");
  if (await appsNav.isVisible().catch(() => false)) {
    await openSidebarView(page, "apps", ".node-agent-studio");
  } else {
    pass("切换到「apps」", "当前角色无节点智能体入口（预期：非 admin）");
  }
  await openSidebarView(page, "workspace", ".workflow-editor, #workflow-console, .workbench-empty");
}

async function testDeepLink(page) {
  const path = page.url();
  if (path.includes("/app/")) {
    pass("URL 深链已同步", path);
  } else {
    fail("URL 深链已同步", `当前 URL: ${path}`);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="workbench-app"]', { timeout: 20000 });
  return assertVisible(page, page.getByTestId("workbench-app"), "刷新后保持工作台");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  if (!(await login(page))) throw new Error("登录失败");
  if (!(await ensureMeetingSelected(page))) throw new Error("选择会议失败");

  await testWorkflowEditor(page);
  await testWorkflowRunLifecycle(page);
  await testMeetingViews(page);
  await testNavViews(page);
  await testDeepLink(page);

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- 测试汇总 ---");
  console.log(`通过 ${results.length - failed.length} / ${results.length}`);
  if (failed.length) {
    console.error("失败项:");
    for (const item of failed) console.error(`  - ${item.step}: ${item.detail}`);
    process.exitCode = 1;
  } else {
    console.log("完整流程测试全部通过。");
  }
} catch (error) {
  console.error("\n流程测试异常:", error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
