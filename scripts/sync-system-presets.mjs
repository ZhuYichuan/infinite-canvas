#!/usr/bin/env node
/**
 * 系统预设资产数据同步脚本。
 *
 * 从公开 CDN 拉取四套预设资产（线稿姿态 / 深度姿态 / 服装 / 发型人像）的索引，
 * 结合仓库内维护的日→中对照表，生成前端可直接引用的静态数据：
 *
 *   web/src/data/system-presets/poses.json     线稿 + 深度姿态（同 id，两种渲染）
 *   web/src/data/system-presets/costumes.json  服装（含英文提示词关键词）
 *   web/src/data/system-presets/portraits.json 发型 / 人像参考
 *
 * 用法：
 *   node scripts/sync-system-presets.mjs            # 拉取并写入数据文件
 *   node scripts/sync-system-presets.mjs --check    # 只比对，有差异则退出码 1（用于 CI）
 *   node scripts/sync-system-presets.mjs --seed <镜像根目录>
 *                                                   # 从本地镜像重建 scripts/system-presets/pose-names.zh.json
 *
 * 图片二进制不入库，CDN 地址在 web/src/lib/assets/system-presets.ts 中集中维护。
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LABELS_PATH = path.join(ROOT, "scripts/system-presets/zh-labels.json");
const POSE_NAMES_PATH = path.join(
  ROOT,
  "scripts/system-presets/pose-names.zh.json",
);
const OUT_DIR = path.join(ROOT, "web/src/data/system-presets");

export const CDN = {
  pose: "https://ai-pose-gallery.pages.dev",
  poseDepth: "https://ai-pose-depth-gallery.pages.dev",
  costume: "https://ai-costume-gallery.pages.dev",
  costumeFull: "https://ai-costume-anime-gallery.pages.dev",
  portrait: "https://ai-portrait-gallery.pages.dev",
};

const SOURCES = {
  pose: `${CDN.pose}/index.json`,
  costume: `${CDN.costume}/index.json`,
  portrait: `${CDN.portrait}/data/images.js`,
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "infinite-canvas-preset-sync/1.0" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.text();
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function requireKey(map, key, where) {
  const hit = map[key];
  if (!hit)
    fail(
      `zh-labels.json 缺少 ${where} 标签：${JSON.stringify(key)}（CDN 新增了条目，请补充对照表后重跑）`,
    );
  return hit;
}

function sortByNumericSuffix(a, b) {
  const na = Number(a.id.match(/(\d+)/)?.[1] ?? 0);
  const nb = Number(b.id.match(/(\d+)/)?.[1] ?? 0);
  return na - nb || a.id.localeCompare(b.id);
}

/** 姿态：CDN 索引按「图片」罗列，这里按姿势聚合成一条资产 + 多机位。 */
function buildPoses(index, labels, poseNames, generatedAt) {
  const seriesMeta = new Map();
  const assets = new Map();

  for (const item of index.items) {
    const angleKey = requireKey(
      labels.pose.angles,
      item["アングル"],
      "pose.angles",
    );
    const suffix = `_${angleKey}`;
    if (!item.id.endsWith(suffix))
      fail(`姿态 id 与机位不符：${item.id} / ${item["アングル"]}`);
    const assetId = item.id.slice(0, -suffix.length);

    const series = requireKey(labels.pose.series, item["系統"], "pose.series");
    const name = poseNames[item["ポーズ名"]];
    if (!name)
      fail(
        `pose-names.zh.json 缺少姿势名：${JSON.stringify(item["ポーズ名"])}`,
      );
    const group = requireKey(labels.pose.groups, item["分類"], "pose.groups");

    if (!seriesMeta.has(series.id))
      seriesMeta.set(series.id, {
        id: series.id,
        name: series.zh,
        nsfw: series.nsfw,
        groups: new Set(),
      });
    seriesMeta.get(series.id).groups.add(group);

    const existing = assets.get(assetId);
    if (existing) {
      existing.angles.push(angleKey);
      continue;
    }
    assets.set(assetId, {
      id: assetId,
      series: series.id,
      group,
      name,
      angles: [angleKey],
      nsfw: series.nsfw,
    });
  }

  const assetList = [...assets.values()]
    .map((asset) => ({ ...asset, angles: asset.angles.sort() }))
    .sort((a, b) => sortByNumericSuffix(a, b));

  return {
    generatedAt,
    source: SOURCES.pose,
    renditions: ["line", "depth"],
    series: [...seriesMeta.values()].map((series) => ({
      ...series,
      groups: [...series.groups],
      count: assetList.filter((asset) => asset.series === series.id).length,
    })),
    assets: assetList,
  };
}

/** 服装：CDN 索引带英文关键词，直接作为提示词注入素材。 */
function buildCostumes(index, labels, generatedAt, dims) {
  const seriesMeta = new Map();
  const assets = index.items
    .map((item) => {
      const series = requireKey(
        labels.costume.series,
        item["カテゴリ"],
        "costume.series",
      );
      if (!seriesMeta.has(series.id))
        seriesMeta.set(series.id, {
          id: series.id,
          name: series.zh,
          nsfw: series.nsfw,
        });
      const promptText = String(item["キーワード"] ?? "").trim();
      return {
        id: item.id,
        series: series.id,
        name: `${series.zh}·${item.id}`,
        promptText,
        nsfw: series.nsfw,
        ...dims,
      };
    })
    .sort(sortByNumericSuffix);

  return {
    generatedAt,
    source: SOURCES.costume,
    series: [...seriesMeta.values()].map((series) => ({
      ...series,
      count: assets.filter((asset) => asset.series === series.id).length,
    })),
    assets,
  };
}

/** 人像：CDN 索引是 window.GALLERY_IMAGES 形式的 JS 文件，不是 JSON。 */
function parseGalleryImages(js) {
  const start = js.indexOf("[");
  const end = js.lastIndexOf("]");
  if (start < 0 || end < 0) fail("images.js 结构无法解析：未找到数组字面量");
  return JSON.parse(js.slice(start, end + 1));
}

function buildPortraits(items, labels, generatedAt) {
  const seriesMeta = new Map();
  const assets = items.map((item) => {
    const section = requireKey(
      labels.portrait.sections,
      item.section,
      "portrait.sections",
    );
    const hair = requireKey(labels.portrait.hair, item.hair, "portrait.hair");
    const seriesId = `${item.section}-${hair.id}`;
    if (!seriesMeta.has(seriesId)) {
      seriesMeta.set(seriesId, {
        id: seriesId,
        name: `${section.zh}·${hair.zh}`,
        nsfw: false,
        section: item.section,
        hair: hair.zh,
      });
    }
    const style = String(item.style ?? "").trim();
    return {
      id: item.id,
      series: seriesId,
      name: style || `${hair.zh}·${item.id.slice(0, 6)}`,
      subtitle:
        style && style !== `${hair.zh}·${item.id.slice(0, 6)}`
          ? `${hair.zh}·${item.id.slice(0, 6)}`
          : undefined,
      promptText: style || undefined,
      nsfw: false,
      width: item.w,
      height: item.h,
    };
  });

  return {
    generatedAt,
    source: SOURCES.portrait,
    series: [...seriesMeta.values()].map((series) => ({
      ...series,
      count: assets.filter((asset) => asset.series === series.id).length,
    })),
    assets,
  };
}

/** 从本地镜像的 metadata_index.json 重建 「日文姿势名 → 中文姿势名」对照表。 */
async function seed(mirrorRoot) {
  const mirror = path.join(mirrorRoot, "posepng/metadata_index.json");
  if (!existsSync(mirror)) fail(`未找到镜像元数据：${mirror}`);
  const items = JSON.parse(await readFile(mirror, "utf8"));
  const names = {};
  for (const item of items) {
    if (item.pose_name_ja && item.pose_name_zh)
      names[item.pose_name_ja] = item.pose_name_zh;
  }
  const sorted = Object.fromEntries(
    Object.entries(names).sort(([a], [b]) => a.localeCompare(b, "ja")),
  );
  await writeFile(
    POSE_NAMES_PATH,
    `${JSON.stringify(sorted, null, 4)}\n`,
    "utf8",
  );
  console.log(
    `✔ 已写入 ${path.relative(ROOT, POSE_NAMES_PATH)}（${Object.keys(sorted).length} 条姿势名）`,
  );
}

/** 用 web/ 里的 prettier（含仓库 .prettierrc）格式化输出，避免与 format:check 打架。 */
async function serialize(data, targetPath) {
  const raw = `${JSON.stringify(data, null, 4)}\n`;
  try {
    const require = createRequire(path.join(ROOT, "web/package.json"));
    const loaded = await import(require.resolve("prettier"));
    const prettier =
      typeof loaded.format === "function" ? loaded : loaded.default;
    const config = (await prettier.resolveConfig(targetPath)) ?? {};
    return await prettier.format(raw, { ...config, parser: "json" });
  } catch {
    return raw;
  }
}

/** 比对时忽略 generatedAt 与空白差异，只看数据本身。 */
function sameData(previous, next) {
  if (!previous) return false;
  const normalize = (text) => {
    const parsed = JSON.parse(text);
    delete parsed.generatedAt;
    return JSON.stringify(parsed);
  };
  try {
    return normalize(previous) === normalize(next);
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--seed") {
    const mirrorRoot = args[1];
    if (!mirrorRoot)
      fail(
        "--seed 需要一个镜像根目录参数，例如 --seed ~/agentwork/test/ai-pose",
      );
    await seed(mirrorRoot);
    return;
  }

  const checkOnly = args.includes("--check");
  const labels = JSON.parse(await readFile(LABELS_PATH, "utf8"));
  const poseNames = JSON.parse(await readFile(POSE_NAMES_PATH, "utf8"));
  const generatedAt = new Date().toISOString().slice(0, 10);

  const [poseIndex, costumeIndex, portraitJs] = await Promise.all([
    fetchText(SOURCES.pose).then(JSON.parse),
    fetchText(SOURCES.costume).then(JSON.parse),
    fetchText(SOURCES.portrait),
  ]);

  const outputs = {
    "poses.json": await serialize(
      buildPoses(poseIndex, labels, poseNames, generatedAt),
      path.join(OUT_DIR, "poses.json"),
    ),
    "costumes.json": await serialize(
      buildCostumes(costumeIndex, labels, generatedAt, {
        width: 512,
        height: 768,
      }),
      path.join(OUT_DIR, "costumes.json"),
    ),
    "portraits.json": await serialize(
      buildPortraits(parseGalleryImages(portraitJs), labels, generatedAt),
      path.join(OUT_DIR, "portraits.json"),
    ),
  };

  await mkdir(OUT_DIR, { recursive: true });
  let drifted = 0;
  for (const [file, content] of Object.entries(outputs)) {
    const target = path.join(OUT_DIR, file);
    const previous = existsSync(target) ? await readFile(target, "utf8") : "";
    const changed = !sameData(previous, content);
    if (!checkOnly) await writeFile(target, content, "utf8");
    if (changed) {
      drifted += 1;
      const count = content.match(/"id": "/g)?.length ?? 0;
      console.log(
        `${checkOnly ? "✖" : "✔"} ${file} ${checkOnly ? "与 CDN 不一致" : "已更新"}（${count} 条资产）`,
      );
    } else {
      console.log(`· ${file} 无变化`);
    }
  }

  if (checkOnly && drifted) {
    console.error(
      `\n✖ ${drifted} 个数据文件与 CDN 不一致，请运行 node scripts/sync-system-presets.mjs 更新后提交`,
    );
    process.exit(1);
  }
}

main().catch((error) => fail(error.stack || String(error)));
