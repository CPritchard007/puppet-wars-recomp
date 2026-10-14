const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./main-BkLt8f6m.js","./diagnostics-De6GANFg.js","./preload-helper-u78yZ8EC.js"])))=>i.map(i=>d[i]);
import { r as reportError } from "./diagnostics-De6GANFg.js";
import { t as __vitePreload } from "./preload-helper-u78yZ8EC.js";
//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region src/bootstrap.js
try {
	await __vitePreload(() => import("./main-BkLt8f6m.js"), __vite__mapDeps([0,1,2]), import.meta.url);
} catch (error) {
	reportError(error, { phase: "startup" });
	document.querySelector("#loading-status").textContent = "Startup failed. Open Diagnostics for details, then reload.";
}
//#endregion

//# sourceMappingURL=index-CFci_0-j.js.map