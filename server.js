import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 로컬 개발에서만 .env를 읽습니다. Render 운영 환경은 대시보드 환경변수를 직접 사용합니다.
if (process.env.NODE_ENV !== "production" && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const parsedPort = Number.parseInt(process.env.PORT ?? "10000", 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 10000;
const isProduction = process.env.NODE_ENV === "production";

/** 환경변수 URL이 올바른 HTTPS 주소인지 확인하고 안전한 값만 브라우저로 보냅니다. */
function getHttpsUrl(value, fallback = "") {
  const candidate = String(value ?? fallback).trim();
  if (!candidate) return "";

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === "https:" ? parsedUrl.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

/** 숫자형 공개 설정이 잘못되면 서울 기본 좌표로 되돌립니다. */
function getFiniteNumber(value, fallback) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

const supabaseUrl = getHttpsUrl(process.env.SUPABASE_URL);
const rawSupabaseKey = String(process.env.SUPABASE_PUBLISHABLE_KEY ?? "").trim();
// 잘못 등록한 service_role/secret key가 config.js로 노출되지 않도록 publishable 접두사를 강제합니다.
const supabasePublishableKey = rawSupabaseKey.startsWith("sb_publishable_") ? rawSupabaseKey : "";
const weatherApiUrl = getHttpsUrl(
  process.env.WEATHER_API_URL,
  "https://api.open-meteo.com/v1/forecast",
);
const publicConfig = Object.freeze({
  configured: Boolean(supabaseUrl && supabasePublishableKey),
  supabaseUrl,
  supabasePublishableKey,
  weatherApiUrl,
  weatherLocationName: String(process.env.WEATHER_LOCATION_NAME ?? "서울").trim() || "서울",
  weatherLatitude: getFiniteNumber(process.env.WEATHER_LATITUDE, 37.5665),
  weatherLongitude: getFiniteNumber(process.env.WEATHER_LONGITUDE, 126.978),
  weatherTimezone: String(process.env.WEATHER_TIMEZONE ?? "Asia/Seoul").trim() || "Asia/Seoul",
});

const publicFiles = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
]);

/** 공개 설정을 JavaScript 문맥에 안전하게 직렬화합니다. */
function createPublicConfigScript() {
  const serializedConfig = JSON.stringify(publicConfig).replaceAll("<", "\\u003c");
  return `window.GREENON_PUBLIC_CONFIG = Object.freeze(${serializedConfig});\n`;
}

/** 모든 응답에 기본 보안 헤더를 적용합니다. */
function setSecurityHeaders(response) {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "https://*.supabase.co";
  const weatherOrigin = weatherApiUrl
    ? new URL(weatherApiUrl).origin
    : "https://api.open-meteo.com";
  const connectSources = ["'self'", supabaseOrigin, weatherOrigin, "wss://*.supabase.co"];

  const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      `connect-src ${connectSources.join(" ")}`,
      "font-src 'self' https://fonts.gstatic.com",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    ];
  if (isProduction) contentSecurityPolicy.push("upgrade-insecure-requests");

  response.setHeader("Content-Security-Policy", contentSecurityPolicy.join("; "));
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  if (isProduction) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

/** 짧은 텍스트·JSON·JavaScript 응답을 HEAD 요청까지 일관되게 보냅니다. */
function sendText(request, response, statusCode, contentType, body, cacheControl = "no-store") {
  const encodedBody = Buffer.from(body);
  response.writeHead(statusCode, {
    "Cache-Control": cacheControl,
    "Content-Type": contentType,
    "Content-Length": encodedBody.length,
  });
  response.end(request.method === "HEAD" ? undefined : encodedBody);
}

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(request, response, 405, "application/json; charset=utf-8", '{"error":"method_not_allowed"}');
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  } catch {
    sendText(request, response, 400, "application/json; charset=utf-8", '{"error":"bad_request"}');
    return;
  }

  if (pathname === "/health") {
    const healthy = !isProduction || publicConfig.configured;
    sendText(
      request,
      response,
      healthy ? 200 : 503,
      "application/json; charset=utf-8",
      JSON.stringify({ status: healthy ? "ok" : "configuration_required", configured: publicConfig.configured }),
    );
    return;
  }

  if (pathname === "/config.js") {
    sendText(
      request,
      response,
      200,
      "text/javascript; charset=utf-8",
      createPublicConfigScript(),
    );
    return;
  }

  if (pathname === "/favicon.ico") {
    response.writeHead(204, { "Cache-Control": "public, max-age=86400" });
    response.end();
    return;
  }

  const publicFile = publicFiles.get(pathname);
  if (!publicFile) {
    sendText(request, response, 404, "application/json; charset=utf-8", '{"error":"not_found"}');
    return;
  }

  try {
    const filePath = join(rootDirectory, publicFile.file);
    const fileStats = await stat(filePath);
    response.writeHead(200, {
      "Cache-Control": publicFile.file === "index.html" ? "no-cache" : "public, max-age=300",
      "Content-Type": publicFile.type,
      "Content-Length": fileStats.size,
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const fileStream = createReadStream(filePath);
    fileStream.on("error", () => {
      if (!response.headersSent) {
        sendText(request, response, 500, "application/json; charset=utf-8", '{"error":"file_read_failed"}');
      } else {
        response.destroy();
      }
    });
    fileStream.pipe(response);
  } catch {
    sendText(request, response, 500, "application/json; charset=utf-8", '{"error":"file_not_available"}');
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Carrier GreenON server listening on port ${port}`);
  if (!publicConfig.configured) {
    console.warn("SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY 설정이 필요합니다.");
  }
});

/** Render가 재배포할 때 새 요청을 그만 받고 기존 연결을 정리합니다. */
function shutdown() {
  server.close((error) => {
    process.exit(error ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// 운영에는 영향을 주지 않으며 배포 전 통합 검사에서 서버를 안전하게 종료하는 데 사용합니다.
export { createPublicConfigScript, publicConfig, server };
