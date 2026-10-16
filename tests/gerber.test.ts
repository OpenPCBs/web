import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { classifyLayer, readZipEntry } from "../app/features/gerber/project";

test("Gerber layer classification preserves fabrication sides and drill files", () => {
  assert.deepEqual(classifyLayer("board-F.Cu.gtl"), { kind: "copper", side: "top" });
  assert.deepEqual(classifyLayer("board-B.Mask.gbs"), { kind: "soldermask", side: "bottom" });
  assert.deepEqual(classifyLayer("board-PTH.drl"), { kind: "drill", side: "all" });
  assert.deepEqual(classifyLayer("board-Edge.Cuts.gm1"), { kind: "outline", side: "all" });
});

test("ZIP decompression stops at the output bound, even for highly compressed data", async () => {
  const zip = new JSZip();
  zip.file("board.gtl", "X".repeat(1_000_000));
  zip.file("small.gbr", "G04 µ-test*\nM02*");
  const compressed = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const archive = await JSZip.loadAsync(compressed);
  await assert.rejects(readZipEntry(archive.files["board.gtl"], 1024), /size limit/);
  const result = await readZipEntry(archive.files["small.gbr"], 1024);
  assert.equal(result.data, "G04 µ-test*\nM02*");
  assert.equal(result.bytes, new TextEncoder().encode(result.data).byteLength);
});
