/**
 * 构建 Windows x64 桌面版文件夹。
 *
 * 前置：npm run build 已生成 .next/standalone（next.config.ts 已开启）。
 * 产物：
 *   release/BanLog-2.2.0-win64/
 *     BanLog.exe
 *     runtime/node.exe
 *     server/...
 *     seed.db
 *     README.txt
 *
 * 双击 BanLog.exe 后：
 *   1. 启动随包附带的 Node.js 与 Next.js standalone 服务；
 *   2. 在原生 WebView2 窗口中打开 BanLog；
 *   3. 退出时自动停止本地服务。
 *
 * 这是原生 Windows 启动器方案，不使用 Electron，因此不需要额外的
 * Chromium 打包，也不会依赖 Electron 运行时。
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const RELEASE_ROOT = path.join(ROOT, "release");
const APP_VERSION = "2.2.0";
const DIST_NAME = `BanLog-${APP_VERSION}-win64`;
const DIST_DIR = path.join(RELEASE_ROOT, DIST_NAME);
const STANDALONE_DIR = path.join(ROOT, ".next", "standalone");
const NEXT_STATIC_DIR = path.join(ROOT, ".next", "static");
const BUILD_DIR = path.join(ROOT, ".desktop-build");
const SEED_TEMP_PATH = path.join(ROOT, "prisma", ".desktop-seed.db");
const ICON_PATH = path.join(ROOT, "build", "icon.ico");
const MANIFEST_PATH = path.join(ROOT, "launcher", "app.manifest");
const SOURCE_PATH = path.join(ROOT, "launcher", "Program.cs");
const WEBVIEW2_VENDOR = path.join(ROOT, "launcher", "vendor", "webview2");
const WEBVIEW2_FILES = [
  "Microsoft.Web.WebView2.Core.dll",
  "Microsoft.Web.WebView2.WinForms.dll",
  "WebView2Loader.dll",
];

function fail(message) {
  throw new Error(message);
}

function assertExists(target, hint) {
  if (!fs.existsSync(target)) {
    fail(`缺少：${target}${hint ? `\n${hint}` : ""}`);
  }
}

function copyDirectory(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function findCSharpCompiler() {
  const windir = process.env.WINDIR || "C:\\Windows";
  const candidates = [
    path.join(windir, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    path.join(windir, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    fail(
      "找不到 .NET Framework C# 编译器 csc.exe。Windows 10/11 通常已内置 .NET Framework 4.8。",
    );
  }
  return found;
}

function prepareStandaloneServer() {
  const serverDest = path.join(DIST_DIR, "server");

  assertExists(
    path.join(STANDALONE_DIR, "server.js"),
    "请先运行 npm run build；当前 Next 配置需要 output: standalone。",
  );
  assertExists(NEXT_STATIC_DIR, "缺少 .next/static。");

  copyDirectory(STANDALONE_DIR, serverDest);
  copyDirectory(NEXT_STATIC_DIR, path.join(serverDest, ".next", "static"));

  const publicDir = path.join(ROOT, "public");
  if (fs.existsSync(publicDir)) {
    copyDirectory(publicDir, path.join(serverDest, "public"));
  }

  for (const envFile of [".env", ".env.local", ".env.production"]) {
    fs.rmSync(path.join(serverDest, envFile), { force: true });
  }

  const prismaSource = path.join(ROOT, "node_modules", ".prisma", "client");
  assertExists(prismaSource, "缺少 Prisma generated client。");
  copyDirectory(
    prismaSource,
    path.join(serverDest, "node_modules", ".prisma", "client"),
  );

  const prismaClientPackage = path.join(
    serverDest,
    "node_modules",
    "@prisma",
    "client",
  );
  if (!fs.existsSync(prismaClientPackage)) {
    copyDirectory(
      path.join(ROOT, "node_modules", "@prisma", "client"),
      prismaClientPackage,
    );
  }

  const engine = fs
    .readdirSync(path.join(serverDest, "node_modules", ".prisma", "client"))
    .find((name) => name.endsWith(".node"));
  if (!engine) {
    fail("没有找到 Prisma SQLite query engine。");
  }

  console.log(`[desktop] server resources ready (Prisma engine: ${engine}).`);
}

function createSeedDatabase() {
  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  assertExists(prismaCli, "请先运行 npm install。");

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${SEED_TEMP_PATH}${suffix}`, { force: true });
  }

  console.log("[desktop] creating empty SQLite seed via Prisma migrations...");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: "file:./.desktop-seed.db",
    },
    stdio: "inherit",
  });

  assertExists(SEED_TEMP_PATH, "Prisma migrate deploy 没有生成 seed 数据库。");
  copyFile(SEED_TEMP_PATH, path.join(DIST_DIR, "seed.db"));

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${SEED_TEMP_PATH}${suffix}`, { force: true });
  }
}

function copyNodeRuntime() {
  const nodeExe = process.execPath;
  if (path.basename(nodeExe).toLowerCase() !== "node.exe") {
    fail(
      `当前构建进程不是 node.exe（实际：${nodeExe}）。请用 npm run desktop:build 在普通 Node.js 环境执行。`,
    );
  }

  const runtimeDir = path.join(DIST_DIR, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  copyFile(nodeExe, path.join(runtimeDir, "node.exe"));

  const nodeDir = path.dirname(nodeExe);
  const licenseCandidates = [
    path.join(nodeDir, "LICENSE"),
    path.join(nodeDir, "LICENSE.md"),
    path.join(nodeDir, "LICENSE.txt"),
  ];
  const license = licenseCandidates.find((candidate) => fs.existsSync(candidate));
  if (license) {
    copyFile(license, path.join(runtimeDir, "LICENSE-node.txt"));
  } else {
    fs.writeFileSync(
      path.join(runtimeDir, "LICENSE-node.txt"),
      `Node.js ${process.version}\nhttps://nodejs.org/en/about/previous-releases\n`,
      "utf8",
    );
  }

  fs.writeFileSync(
    path.join(runtimeDir, "VERSION.txt"),
    `Node.js ${process.version}\nArchitecture: ${process.arch}\n`,
    "utf8",
  );

  console.log(`[desktop] Node runtime copied (${process.version}).`);
}

function copyChineseData() {
  const dataDir = path.join(ROOT, "data");
  const mapPath = path.join(dataDir, "anilist-chinese.json");

  if (!fs.existsSync(mapPath)) {
    console.warn(
      "[desktop] Chinese title map is missing; run npm run sync:chinese to enable Chinese titles.",
    );
    return;
  }

  copyDirectory(dataDir, path.join(DIST_DIR, "data"));
  console.log("[desktop] Chinese title map copied.");
}

function compileLauncher() {
  const csc = findCSharpCompiler();
  const exePath = path.join(DIST_DIR, "BanLog.exe");

  assertExists(SOURCE_PATH);
  assertExists(ICON_PATH, "缺少 build/icon.ico。");
  assertExists(MANIFEST_PATH);

  for (const file of WEBVIEW2_FILES) {
    assertExists(
      path.join(WEBVIEW2_VENDOR, file),
      "缺少 WebView2 SDK 文件，请重新准备 launcher/vendor/webview2。",
    );
  }

  for (const file of WEBVIEW2_FILES) {
    copyFile(path.join(WEBVIEW2_VENDOR, file), path.join(DIST_DIR, file));
  }

  const args = [
    "/nologo",
    "/target:winexe",
    "/platform:x64",
    "/optimize+",
    "/codepage:65001",
    `/out:${exePath}`,
    `/win32icon:${ICON_PATH}`,
    `/win32manifest:${MANIFEST_PATH}`,
    "/reference:System.dll",
    "/reference:System.Core.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Windows.Forms.dll",
    `/reference:${path.join(WEBVIEW2_VENDOR, "Microsoft.Web.WebView2.Core.dll")}`,
    `/reference:${path.join(WEBVIEW2_VENDOR, "Microsoft.Web.WebView2.WinForms.dll")}`,
    SOURCE_PATH,
  ];

  console.log("[desktop] compiling native WebView2 launcher...");
  const result = spawnSync(csc, args, {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.status !== 0 || !fs.existsSync(exePath)) {
    fail("C# 启动器编译失败。");
  }

  console.log(`[desktop] launcher compiled: ${exePath}`);
}

function copyDocs() {
  copyFile(
    path.join(ROOT, "desktop", "README.txt"),
    path.join(DIST_DIR, "README.txt"),
  );
  copyFile(
    path.join(WEBVIEW2_VENDOR, "LICENSE.txt"),
    path.join(DIST_DIR, "WebView2-LICENSE.txt"),
  );
  copyFile(
    path.join(WEBVIEW2_VENDOR, "NOTICE.txt"),
    path.join(DIST_DIR, "WebView2-NOTICE.txt"),
  );
  copyFile(
    path.join(WEBVIEW2_VENDOR, "VERSION.txt"),
    path.join(DIST_DIR, "WebView2-VERSION.txt"),
  );

  fs.writeFileSync(
    path.join(DIST_DIR, "BUILD_INFO.txt"),
    [
      `BanLog ${APP_VERSION} Windows desktop`,
      `Built: ${new Date().toISOString()}`,
      `Node: ${process.version} (${process.arch})`,
      "Launcher: .NET Framework WinForms x64 + WebView2",
      "Server: Next.js standalone",
      "Chinese titles: local soruly/anilist-chinese map",
      "Chinese synopsis: on-demand translation cache in SQLite",
      "Database: SQLite (portable BanLogData next to exe; writable-location fallback)",
      "",
    ].join("\r\n"),
    "utf8",
  );
}

function createZip() {
  const zipPath = path.join(
    RELEASE_ROOT,
    `BanLog-${APP_VERSION}-win64.zip`,
  );
  fs.rmSync(zipPath, { force: true });

  console.log("[desktop] creating portable zip...");
  const command =
    `Compress-Archive -LiteralPath '${DIST_DIR.replace(/'/g, "''")}' ` +
    `-DestinationPath '${zipPath.replace(/'/g, "''")}' ` +
    "-CompressionLevel Optimal -Force";

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { stdio: "inherit", windowsHide: true },
  );

  if (result.status !== 0 || !fs.existsSync(zipPath)) {
    console.warn("[desktop] ZIP creation failed; the folder is still usable.");
    return;
  }

  console.log(`[desktop] zip created: ${zipPath}`);
}

function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    fail("桌面 exe 构建目前只支持 Windows x64。");
  }

  console.log(`[desktop] target: ${DIST_DIR}`);
  fs.mkdirSync(RELEASE_ROOT, { recursive: true });
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  prepareStandaloneServer();
  createSeedDatabase();
  copyNodeRuntime();
  copyChineseData();
  compileLauncher();
  copyDocs();

  const exePath = path.join(DIST_DIR, "BanLog.exe");
  const seedPath = path.join(DIST_DIR, "seed.db");
  const runtimePath = path.join(DIST_DIR, "runtime", "node.exe");
  const serverPath = path.join(DIST_DIR, "server", "server.js");
  const nodeModulesPath = path.join(DIST_DIR, "server", "node_modules");
  const webViewCorePath = path.join(
    DIST_DIR,
    "Microsoft.Web.WebView2.Core.dll",
  );
  const webViewLoaderPath = path.join(DIST_DIR, "WebView2Loader.dll");
  for (const required of [
    exePath,
    seedPath,
    runtimePath,
    serverPath,
    nodeModulesPath,
    webViewCorePath,
    webViewLoaderPath,
  ]) {
    assertExists(required);
  }

  createZip();

  console.log("\n[desktop] build complete:");
  console.log(`  🖥  ${exePath}`);
  console.log(`  📦  ${path.join(RELEASE_ROOT, `BanLog-${APP_VERSION}-win64.zip`)}`);
  console.log(
    "\n双击 BanLog.exe 启动。首次启动会优先在程序目录的 BanLogData 创建数据库。",
  );
}

try {
  main();
} catch (error) {
  console.error(
    `\n[desktop] build failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
