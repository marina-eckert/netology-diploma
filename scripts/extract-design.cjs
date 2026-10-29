const fs = require("fs"),
  zlib = require("zlib"),
  kiwi = require("kiwi-schema");
const b = fs.readFileSync("design/canvas.fig");
let p = 12;
const chunks = [];
while (p + 4 < b.length) {
  let n = b.readUInt32LE(p);
  p += 4;
  chunks.push(b.subarray(p, p + n));
  p += n;
}
function unpack(b) {
  try {
    return zlib.inflateRawSync(b);
  } catch {
    return zlib.zstdDecompressSync(b);
  }
}
const schema = kiwi.decodeBinarySchema(unpack(chunks[0]));
const data = kiwi.compileSchema(schema).decodeMessage(unpack(chunks[1]));
fs.writeFileSync("design/decoded.json", JSON.stringify(data));
console.log(Object.keys(data));
const nodes = data.nodeChanges || [];
fs.writeFileSync(
  "design/texts.json",
  JSON.stringify(
    nodes
      .filter((n) => n.type === "TEXT")
      .map((n) => ({
        name: n.name,
        text: n.textData?.characters || n.characters,
        fill: n.fillPaints,
        font: n.fontSize,
      })),
    null,
    2,
  ),
);
console.log(nodes.slice(0, 3));
