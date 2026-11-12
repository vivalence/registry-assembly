export const STAGES = ["sniff", "validate", "decode", "review", "commit"];

export const status = (job) => ({ done: "DONE", parsed: "READ", warn: "WARN", run: "RUN", wait: "WAIT", fail: "FAIL" })[job.state] ?? "WAIT";

export const label = (job) => {
  if (job.state === "done") return "COMMITTED";
  if (job.state === "wait") return "QUEUED";
  if (job.state === "parsed") return "REVIEW";
  return (job.stage ?? STAGES[Math.min(4, Math.floor(job.progress / 20))]).toUpperCase();
};

export const size = (vector) => `${vector.map((value) => (value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(2) : value.toFixed(3)).replace(/\.?0+$/, "")).join(" × ")} m`;

const stem = (name) => (name ?? "").replace(/\.[^.]+$/, "");

export const humanize = (name) =>
  stem(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());

export const defaults = (reading) => ({
  into: humanize(reading.source) || reading.source,
  unit: reading.declared?.unit ?? 1,
  up: reading.declared?.up ?? "Y",
  fold: "fingerprint",
  groups: true,
  hidden: false,
  ...(["step", "iges"].includes(reading.format) && { chord: 0.05 }),
});

export const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

export const thousands = (n) => (n == null ? "—" : Number(n).toLocaleString("en").replace(/,/g, " "));

export const metres = (unit) => (unit == null ? "—" : unit === 1 ? "1.0 m" : unit === 0.001 ? "1.0 mm" : unit === 0.01 ? "1.0 cm" : `${unit} m`);
