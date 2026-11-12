import { join } from "@std/path";
import paladin from "@vivalence/paladin";
import { crypto, mime } from "@vivalence/typology";

// a file already on the mount becomes a File row — the repository verb FILESINK's receive ends in
export const recorded = async (ctx, path) => {
  const mount = join(ctx.mode.mountpoint.absolute, path);
  const bytes = await paladin.read.bytes(mount);
  const hash = await crypto.digestBytes(bytes);
  const file = await ctx.entities.file.ensure({ mode: ctx.mode.id, path, mount, mime: mime.of(path), hash, integrity: `sha256-${hash}`, bytes: bytes.length });
  await ctx.entities.em.flush();
  return file;
};
