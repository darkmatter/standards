import { execFileSync } from "node:child_process";

export function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
}

export function snapshot(repo, ref) {
  // Only tracked source/config blobs. Symlinks and submodules are never followed.
  const entries = git(repo, ["ls-tree", "-r", "-z", ref]).split("\0").filter(Boolean);
  const selected = entries.flatMap((entry) => {
    const split = entry.indexOf("\t");
    const metadata = entry.slice(0, split);
    const file = entry.slice(split + 1);
    if (/(?:^|\/)(?:node_modules|vendor|dist|build)\//.test(file)) return [];
    if (!metadata.startsWith("100") || !/\.(?:[cm]?[jt]sx?|json)$/.test(file)) return [];
    return [{ file, oid: metadata.split(" ")[2] }];
  });
  const blobs = execFileSync("git", ["-C", repo, "cat-file", "--batch"], {
    input: selected.map(({ oid }) => oid).join("\n") + "\n",
    maxBuffer: 128 * 1024 * 1024,
  });
  const files = new Map();
  let offset = 0;
  for (const { file } of selected) {
    const end = blobs.indexOf(10, offset);
    const size = Number(blobs.subarray(offset, end).toString().split(" ")[2]);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Invalid Git blob response");
    offset = end + 1;
    files.set(file, blobs.subarray(offset, offset + size).toString("utf8"));
    offset += size + 1;
  }
  return files;
}

export function renamedFiles(repo, base, head) {
  const fields = git(repo, [
    "diff",
    "--name-status",
    "-z",
    "--find-renames",
    base,
    head,
    "--",
  ]).split("\0");
  const renames = new Map();
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++];
    const oldFile = fields[i++];
    if (status.startsWith("R") || status.startsWith("C")) {
      const newFile = fields[i++];
      if (status.startsWith("R")) renames.set(newFile, oldFile);
    }
  }
  return renames;
}
