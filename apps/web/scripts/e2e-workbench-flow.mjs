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
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });

  const loginEntry = page.getByRole("button", { name: "登录" }).first();
  if (await loginEntry.isVisible().catch(() => false)) {
    await loginEntry.click();
    await page.waitForTimeout(300);
    const loginForm = page.locator(".auth-page--login.auth-page--active");
    await loginForm.getByPlaceholder("admin@meetingflow.local").fill(email);
    await loginForm.getByLabel("密码").fill(password);
    await loginForm.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForSelector(".workbench-shell", { timeout: 15000 });
  }

  return assertVisible(page, page.locator(".workbench-shell"), "登录并进入工作台");
}

async function selectMeeting(page) {
  const cards = page.locator(".meeting-card");
  const count = await cards.count();
  if (count === 0) {
    fail("选择会议", "会议列表为空");
    return false;
  }
  await cards.first().click();
  await page.waitForTimeout(800);
  return assertVisible(page, page.locator(".workflow-shell"), "选择会议并加载流程画布");
}

async function switchMode(page, label, shellClass) {
  const button = page.getByRole("button", { name: label, exact: true });
  await button.click();
  await page.waitForTimeout(700);
  return assertVisible(page, page.locator(`.workflow-shell.${shellClass}`), `切换到「${label}」`);
}

async function measureSwitcherCenter(page) {
  const box = await page.locator(".workflow-mode-switcher").boundingBox();
  if (!box) return null;
  return box.x + box.width / 2;
}

async function testModeSwitcherStability(page) {
  const modes = [
    ["运行视图", "is-simple"],
    ["编辑画布", "is-editing"],
    ["详情面板", "is-detail"],
    ["拓展工具", "is-more"],
    ["运行视图", "is-simple"]
  ];

  const centers = [];
  for (const [label] of modes) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(500);
    const center = await measureSwitcherCenter(page);
    if (center == null) {
      fail("模式切换器位置稳定", `无法在「${label}」读取位置`);
      return;
    }
    centers.push({ label, center });
  }

  const maxDelta = Math.max(...centers.map((c) => c.center)) - Math.min(...centers.map((c) => c.center));
  if (maxDelta <= 1) {
    pass("模式切换器位置稳定", `最大偏移 ${maxDelta.toFixed(2)}px`);
  } else {
    fail("模式切换器位置稳定", `最大偏移 ${maxDelta.toFixed(2)}px（${centers.map((c) => `${c.label}:${c.center.toFixed(1)}`).join(", ")}）`);
  }
}

async function testDetailTabs(page) {
  await switchMode(page, "详情面板", "is-detail");
  for (const tab of ["运行", "会议", "记忆"]) {
    const tabButton = page.locator('.workflow-side-tabs[aria-label="详情面板视图"] button', { hasText: tab });
    if (await tabButton.isVisible().catch(() => false)) {
      await tabButton.click();
      await page.waitForTimeout(400);
      pass(`详情面板 Tab「${tab}」`);
    } else {
      fail(`详情面板 Tab「${tab}」`, "Tab 不可见");
    }
  }
}

async function testExtensionTabs(page) {
  await switchMode(page, "拓展工具", "is-more");
  for (const tab of ["工作流 Agent", "日历同步"]) {
    const tabButton = page.locator('.workflow-side-tabs[aria-label="拓展工具视图"] button', { hasText: tab });
    if (await tabButton.isVisible().catch(() => false)) {
      await tabButton.click();
      await page.waitForTimeout(400);
      pass(`拓展工具 Tab「${tab}」`);
    } else {
      fail(`拓展工具 Tab「${tab}」`, "Tab 不可见");
    }
  }
}

async function testEditToolbar(page) {
  await switchMode(page, "编辑画布", "is-editing");
  await assertVisible(page, page.locator(".node-palette--toolbar"), "编辑模式模板工具条");
  await assertVisible(page, page.locator(".ide-inspector"), "编辑模式 Inspector 侧栏");
  for (const action of ["添加节点", "保存画布"]) {
    await assertVisible(page, page.getByRole("button", { name: action }), `编辑操作「${action}」`);
  }
}

async function testRunView(page) {
  await switchMode(page, "运行视图", "is-simple");
  await assertVisible(page, page.locator(".workflow-canvas-summary"), "运行视图摘要栏");
  const runButton = page.getByRole("button", { name: /启动流程|继续流程/ });
  if (await runButton.isVisible().catch(() => false)) {
    pass("运行视图流程按钮可见");
  } else {
    fail("运行视图流程按钮可见");
  }
}

async function testNavViews(page) {
  await page.getByRole("button", { name: "节点智能体管理" }).click();
  await page.waitForTimeout(600);
  await assertVisible(page, page.locator(".workbench-main--apps"), "切换到节点智能体管理");

  await page.getByRole("button", { name: "会议流程管理" }).click();
  await page.waitForTimeout(600);
  await assertVisible(page, page.locator(".workbench-grid--simplified"), "返回会议流程管理");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  if (!(await login(page))) throw new Error("登录失败");
  if (!(await selectMeeting(page))) throw new Error("选择会议失败");

  await testRunView(page);
  await testEditToolbar(page);
  await testDetailTabs(page);
  await testExtensionTabs(page);
  await testModeSwitcherStability(page);
  await testNavViews(page);

  await switchMode(page, "编辑画布", "is-editing");
  const agentLink = page.getByRole("button", { name: "在节点智能体管理中编辑" });
  if (await agentLink.isVisible().catch(() => false)) {
    await agentLink.click();
    await page.waitForTimeout(800);
    await assertVisible(page, page.locator(".node-agent-manager"), "从画布跳转到节点智能体管理");
    await assertVisible(page, page.locator(".node-agent-playground"), "Prompt Playground");
    await page.getByRole("tab", { name: "版本" }).click();
    await page.waitForTimeout(500);
    await assertVisible(page, page.locator(".node-agent-version-diff"), "版本 Diff 面板");
    pass("节点智能体 Studio Tab");
  } else {
    fail("画布跳转节点智能体", "编辑入口不可见");
  }

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
