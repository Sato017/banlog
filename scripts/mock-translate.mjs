/**
 * 本地测试用 Google Translate 兼容 mock。
 *
 * 启动：
 *   npm run mock:translate
 *
 * 另一个终端：
 *   $env:TRANSLATE_API_URL="http://127.0.0.1:4012/translate_a/single"
 *   npm run dev
 *
 * 它只用于验证中文简介写库/缓存/前端回退，不是真实翻译服务。
 */
import http from "node:http";
import process from "node:process";

const PORT = Number(process.env.TRANSLATE_MOCK_PORT ?? 4012);
let requestCount = 0;
const seen = new Set();

const server = http.createServer((request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? `127.0.0.1:${PORT}`}`,
  );

  if (url.pathname === "/__stats") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        requests: requestCount,
        uniqueTexts: seen.size,
      }),
    );
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method Not Allowed");
    return;
  }

  const text = url.searchParams.get("q") ?? "";
  requestCount += 1;
  seen.add(text);

  const translated = text
    ? `中文翻译测试：${text.slice(0, 110)}`
    : "";

  // 模拟 Google translate_a/single 的嵌套数组结构。
  const payload = [
    [[translated, text, null, null, 10]],
    null,
    "en",
    null,
    null,
    null,
    1,
  ];

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[mock-translate] http://127.0.0.1:${PORT}/translate_a/single`,
  );
  console.log("[mock-translate] stats: http://127.0.0.1:4012/__stats");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
