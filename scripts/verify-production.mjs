import { access, readFile, readdir } from "node:fs/promises";
import { Script } from "node:vm";

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "server.js",
  "config.js",
  ".env.example",
  "render.yaml",
  "README.md",
];

// 홈 히어로가 빈 화면으로 배포되지 않도록 생성 이미지의 존재도 별도로 검사합니다.
const requiredAssetFiles = [
  "assets/greenon-clear-water-hero.webp",
  "assets/greenon-cool-cloud-character.webp",
];

const forbiddenPatterns = [
  new RegExp(`sb_${"secret"}_[A-Za-z0-9_-]+`),
  new RegExp(`${"SUPABASE_SERVICE_ROLE_KEY"}\\s*=`),
  /service_role\s*[:=]\s*["'][^"']+/,
  /sb_publishable_(?!your_public_key)[A-Za-z0-9_-]{12,}/,
];

const fileContents = new Map();
for (const fileName of requiredFiles) {
  fileContents.set(fileName, await readFile(fileName, "utf8"));
}

for (const assetFileName of requiredAssetFiles) {
  await access(assetFileName);
}

new Script(fileContents.get("app.js"), { filename: "app.js" });

const indexHtml = fileContents.get("index.html");
if (!indexHtml.includes('<script src="config.js"></script>')) {
  throw new Error("index.html에 런타임 config.js가 연결되지 않았습니다.");
}

if (indexHtml.includes("supabase-config.js")) {
  throw new Error("이전 하드코딩 Supabase 설정 참조가 남아 있습니다.");
}

/** 저장소의 텍스트 소스 전체를 찾아 하드코딩된 운영 키가 없는지 확인합니다. */
async function collectTextFiles(directory = ".") {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  const allowedExtensions = /(?:\.js|\.mjs|\.html|\.css|\.json|\.ya?ml|\.md|\.sql|\.txt|\.example)$/;

  for (const entry of entries) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const entryPath = directory === "." ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...(await collectTextFiles(entryPath)));
    } else if (allowedExtensions.test(entry.name)) {
      results.push(entryPath);
    }
  }

  return results;
}

for (const fileName of await collectTextFiles()) {
  const contents = await readFile(fileName, "utf8");
  for (const forbiddenPattern of forbiddenPatterns) {
    if (forbiddenPattern.test(contents)) {
      throw new Error(`${fileName}에서 서버 전용 비밀키 패턴을 발견했습니다.`);
    }
  }
}

console.log(
  `Production verification passed (${requiredFiles.length} required files, ${requiredAssetFiles.length} assets).`,
);
