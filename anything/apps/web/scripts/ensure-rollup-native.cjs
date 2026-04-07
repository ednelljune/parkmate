const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const rollupPackageJsonPath = path.join(rootDir, "node_modules", "rollup", "package.json");

if (!fs.existsSync(rollupPackageJsonPath)) {
  console.log("Rollup is not installed yet; skipping native binary check.");
  process.exit(0);
}

const rollupVersion = JSON.parse(fs.readFileSync(rollupPackageJsonPath, "utf8")).version;

function detectLibc() {
  if (process.platform !== "linux") {
    return null;
  }

  const report = typeof process.report?.getReport === "function" ? process.report.getReport() : null;
  if (report?.header?.glibcVersionRuntime) {
    return "gnu";
  }

  const sharedObjects = Array.isArray(report?.sharedObjects) ? report.sharedObjects : [];
  if (sharedObjects.some((value) => String(value).toLowerCase().includes("musl"))) {
    return "musl";
  }

  return "gnu";
}

function getRollupNativePackageName() {
  const libc = detectLibc();
  const key = `${process.platform}-${process.arch}${libc ? `-${libc}` : ""}`;

  const packageNames = {
    "android-arm": "@rollup/rollup-android-arm-eabi",
    "android-arm64": "@rollup/rollup-android-arm64",
    "darwin-arm64": "@rollup/rollup-darwin-arm64",
    "darwin-x64": "@rollup/rollup-darwin-x64",
    "freebsd-arm64": "@rollup/rollup-freebsd-arm64",
    "freebsd-x64": "@rollup/rollup-freebsd-x64",
    "linux-arm-gnu": "@rollup/rollup-linux-arm-gnueabihf",
    "linux-arm-musl": "@rollup/rollup-linux-arm-musleabihf",
    "linux-arm64-gnu": "@rollup/rollup-linux-arm64-gnu",
    "linux-arm64-musl": "@rollup/rollup-linux-arm64-musl",
    "linux-loong64-gnu": "@rollup/rollup-linux-loong64-gnu",
    "linux-loong64-musl": "@rollup/rollup-linux-loong64-musl",
    "linux-ppc64-gnu": "@rollup/rollup-linux-ppc64-gnu",
    "linux-ppc64-musl": "@rollup/rollup-linux-ppc64-musl",
    "linux-riscv64-gnu": "@rollup/rollup-linux-riscv64-gnu",
    "linux-riscv64-musl": "@rollup/rollup-linux-riscv64-musl",
    "linux-s390x-gnu": "@rollup/rollup-linux-s390x-gnu",
    "linux-x64-gnu": "@rollup/rollup-linux-x64-gnu",
    "linux-x64-musl": "@rollup/rollup-linux-x64-musl",
    "openbsd-x64": "@rollup/rollup-openbsd-x64",
    "win32-arm64": "@rollup/rollup-win32-arm64-msvc",
    "win32-ia32": "@rollup/rollup-win32-ia32-msvc",
    "win32-x64": "@rollup/rollup-win32-x64-msvc"
  };

  return packageNames[key] ?? null;
}

const nativePackageName = getRollupNativePackageName();

if (!nativePackageName) {
  console.log(`No Rollup native package mapping for ${process.platform}/${process.arch}; skipping.`);
  process.exit(0);
}

try {
  require.resolve(nativePackageName);
  console.log(`Rollup native package already present: ${nativePackageName}`);
  process.exit(0);
} catch (error) {
  if (error?.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
console.log(`Installing missing Rollup native package: ${nativePackageName}@${rollupVersion}`);

childProcess.execFileSync(
  npmExecutable,
  [
    "install",
    "--no-save",
    "--no-package-lock",
    "--ignore-scripts",
    "--legacy-peer-deps",
    `${nativePackageName}@${rollupVersion}`
  ],
  {
    cwd: rootDir,
    stdio: "inherit"
  }
);
