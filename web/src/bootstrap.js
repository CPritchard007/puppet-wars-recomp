import { reportError } from './diagnostics.js';
try { await import('./main.js'); }
catch(error) { reportError(error, { phase: 'startup' }); document.querySelector('#loading-status').textContent='Startup failed. Open Diagnostics for details, then reload.'; }
