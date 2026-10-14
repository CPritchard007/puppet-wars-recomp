//#region src/diagnostics.js
var entries = [];
var nativeConsoleError = console.error.bind(console);
function describe(value) {
	try {
		return typeof value === "string" ? value : JSON.stringify(value);
	} catch {
		return String(value);
	}
}
var panel = document.querySelector("#diagnostics");
var list = document.querySelector("#error-list");
var badge = document.querySelector("#error-count");
var seen = /* @__PURE__ */ new Map();
var context = {
	phase: "starting",
	episode: null
};
function setContext(value) {
	Object.assign(context, value);
}
function reportError(value, details = {}) {
	const error = value instanceof Error ? value : new Error(describe(value));
	const key = `${error.message}:${details.url || ""}`;
	if (seen.has(key)) {
		seen.get(key).occurrences++;
		return;
	}
	const entry = {
		time: (/* @__PURE__ */ new Date()).toISOString(),
		message: error.message,
		stack: error.stack || "",
		...context,
		...details,
		occurrences: 1
	};
	entries.push(entry);
	seen.set(key, entry);
	if (entries.length > 50) {
		const old = entries.shift();
		for (const [k, v] of seen) if (v === old) seen.delete(k);
	}
	nativeConsoleError("[Puppet War]", error, details);
	badge.textContent = String(entries.length);
	const row = document.createElement("details");
	row.open = true;
	const title = document.createElement("summary");
	title.textContent = `${entry.time.slice(11, 19)} · ${entry.message}`;
	const pre = document.createElement("pre");
	pre.textContent = JSON.stringify(entry, null, 2);
	row.append(title, pre);
	list.prepend(row);
	while (list.children.length > 50) list.lastElementChild.remove();
	panel.hidden = false;
	document.dispatchEvent(new CustomEvent("gameerror", { detail: entry }));
}
console.error = (...args) => reportError(args.find((arg) => arg instanceof Error) || new Error(args.map(describe).join(" ")), { kind: "console.error" });
async function fetchJSON(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 2e4);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
		return await response.json();
	} catch (error) {
		reportError(error, { url });
		throw error;
	} finally {
		clearTimeout(timer);
	}
}
window.addEventListener("error", (event) => {
	if (event.target !== window) reportError(/* @__PURE__ */ new Error("Asset failed to load"), { url: event.target.src || event.target.href || "unknown" });
	else reportError(event.error || new Error(event.message), {
		file: event.filename,
		line: event.lineno,
		column: event.colno
	});
}, true);
window.addEventListener("unhandledrejection", (event) => reportError(event.reason, { kind: "unhandled promise rejection" }));
document.querySelector("#show-errors").onclick = () => {
	panel.hidden = !panel.hidden;
};
document.querySelector("#close-errors").onclick = () => {
	panel.hidden = true;
};
function diagnosticText() {
	return JSON.stringify({
		userAgent: navigator.userAgent,
		location: location.href,
		context,
		errors: entries
	}, null, 2);
}
document.querySelector("#copy-errors").onclick = async () => {
	try {
		await navigator.clipboard.writeText(diagnosticText());
		document.querySelector("#diagnostic-status").textContent = "Diagnostics copied.";
	} catch {
		document.querySelector("#diagnostic-status").textContent = "Clipboard unavailable. Use Download instead.";
	}
};
document.querySelector("#download-errors").onclick = () => {
	const url = URL.createObjectURL(new Blob([diagnosticText()], { type: "application/json" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = "puppet-war-diagnostics.json";
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1e3);
};
function readSaved(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch (error) {
		reportError(error, { operation: `read saved ${key}` });
		return fallback;
	}
}
function save(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		reportError(error, { operation: `save ${key}` });
	}
}
window.puppetDiagnostics = {
	reportError,
	getEntries: () => structuredClone(entries),
	test: () => reportError(/* @__PURE__ */ new Error("Diagnostic test error — reporting is working"), { kind: "manual test" })
};
//#endregion
export { setContext as a, save as i, readSaved as n, reportError as r, fetchJSON as t };

//# sourceMappingURL=diagnostics-De6GANFg.js.map