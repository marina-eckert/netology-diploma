const fs = require("fs");
const n = JSON.parse(fs.readFileSync("design/decoded.json"));
const nodes = n.nodeChanges;
const k = (g) => `${g.sessionID}:${g.localID}`;
const children = (g) =>
  nodes.filter((x) => x.parentIndex && k(x.parentIndex.guid) === k(g));
const descendants = (x) => [x, ...children(x.guid).flatMap(descendants)];
const main = nodes.find((x) => k(x.guid) === "1:810");
const cards = descendants(main).filter((x) => /^card \d+$/.test(x.name));
const seen = new Set();
const books = [];
fs.mkdirSync("public/covers", { recursive: true });
function copyImage(node, name) {
  const paint = node?.fillPaints?.find((p) => p.image);
  if (!paint) return null;
  const hash = Buffer.from(Object.values(paint.image.hash)).toString("hex");
  const src = `design/images/${hash}`;
  if (!fs.existsSync(src)) return null;
  fs.copyFileSync(src, `public/${name}`);
  return "/" + name;
}
for (const card of cards) {
  const all = descendants(card),
    texts = all
      .filter((x) => x.type === "TEXT")
      .map((x) => x.textData?.characters)
      .filter(Boolean);
  const title = texts[0]?.replace(/\n/g, " ");
  if (!title || seen.has(title)) continue;
  seen.add(title);
  const valueAfter = (label) =>
    texts[texts.findIndex((t) => t.trim() === label) + 1];
  const cover = all.find((x) => x.fillPaints?.some((p) => p.image));
  const image = copyImage(cover, `covers/cover-${books.length + 1}.jpg`);
  books.push({
    title,
    author: valueAfter("Автор:"),
    year: Number(valueAfter("Год:")),
    description: valueAfter("Описание:") || valueAfter("Описание: "),
    coverImage: image,
  });
}
const map = nodes.find((x) => x.name === "img map");
copyImage(map, "map.jpg");
fs.writeFileSync("server/seed-books.json", JSON.stringify(books, null, 2));
console.log(books.map((b) => b.title));
const pkg = JSON.parse(fs.readFileSync("package.json"));
pkg.overrides = { multer: "$multer" };
pkg.scripts["dev:api"] =
  'tsc -p tsconfig.server.json && concurrently "tsc -p tsconfig.server.json --watch" "node --watch dist-server/main.js"';
pkg.scripts.build =
  "tsc -p tsconfig.server.json && tsc -p tsconfig.json && vite build";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
