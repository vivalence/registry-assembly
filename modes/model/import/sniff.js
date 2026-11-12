import { FORMATS } from "./schematics.js";

const ascii = (bytes, length = 96) => new TextDecoder("latin1").decode(bytes.subarray(0, length));

const zipped = (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b;

const binaryStl = (bytes) =>
  bytes.length >= 84 && 84 + new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true) * 50 === bytes.length;

const igesRecord = (head) => head.length >= 80 && head[72] === "S" && /^ *1$/.test(head.slice(73, 80));

export const extensionOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

export const formatOf = (extension) => Object.keys(FORMATS).find((key) => FORMATS[key].extensions.includes(extension)) ?? null;

export const magic = (bytes) => {
  const head = ascii(bytes);
  if (head.startsWith("BLENDER")) return "blend";
  if (head.startsWith("glTF")) return "glb";
  if (head.startsWith("Kaydara FBX Binary") || /^;\s*FBX/.test(head)) return "fbx";
  if (head.startsWith("PXR-USDC")) return "usdc";
  if (head.startsWith("#usda")) return "usd";
  if (head.startsWith("ISO-10303-21")) return "step";
  if (bytes[0] === 0x4d && bytes[1] === 0x4d) return "3ds";
  if (zipped(bytes)) return "usdz";
  if (igesRecord(head)) return "iges";
  if (binaryStl(bytes) || /^solid\b/.test(head)) return "stl";
  if (/^\s*\{/.test(head)) return "gltf";
  if (/^(#|v |vn |vt |o |g |s |mtllib |usemtl |f )/m.test(head)) return "obj";
  return null;
};

export const sniff = (bytes, name) => {
  const extension = extensionOf(name);
  const claimed = formatOf(extension);
  const found = magic(bytes);
  return { format: found ?? claimed, extension, claimed, found, matched: Boolean(found) && found === claimed };
};
