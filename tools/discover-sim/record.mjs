// Records index.html frame by frame in headless Chrome (render(t) per frame, so timing is exact):
//   node tools/discover-sim/record.mjs <outDir> [--fps=60] [--scale=2] [--at=1.5,4,9]
// --at writes only those stills (for checking); otherwise every frame 0…END as 00000.png…
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const out = args.find(a => !a.startsWith("--"));
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split("=")[1];
const fps = Number(opt("fps") ?? 60), scale = Number(opt("scale") ?? 2), at = opt("at")?.split(",").map(Number);
mkdirSync(out, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "sim-chrome-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--hide-scrollbars",
  "--force-color-profile=srgb", "--disable-gpu-vsync", "about:blank"], { stdio: "ignore" });
const portFile = join(profile, "DevToolsActivePort");
while (!existsSync(portFile) || !readFileSync(portFile, "utf8").includes("\n")) await new Promise(r => setTimeout(r, 100));
const port = readFileSync(portFile, "utf8").split("\n")[0];
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener("message", m => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, d => d.error ? rej(new Error(d.error.message)) : res(d.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send("Emulation.setDeviceMetricsOverride", { width: 404, height: 472, deviceScaleFactor: scale, mobile: false });
const page = pathToFileURL(join(fileURLToPath(new URL(".", import.meta.url)), "index.html")).href + "?record";
await send("Page.navigate", { url: page });
while (!(await evaluate("!!window.ready").catch(() => false))) await new Promise(r => setTimeout(r, 100));
const END = await evaluate("window.ready.then(() => window.END)");

const shoot = async (t, name) => {
  await evaluate(`render(${t}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(out, name), Buffer.from(data, "base64"));
};
if (at) for (const t of at) await shoot(t, `at-${t}.png`);
else {
  const n = Math.round(END * fps);
  for (let f = 0; f < n; f++) { await shoot(f / fps, String(f).padStart(5, "0") + ".png"); if (f % 120 === 0) process.stdout.write(`${f}/${n} `); }
  console.log(`\n${n} frames, ${END}s at ${fps}fps`);
}
chrome.kill();
