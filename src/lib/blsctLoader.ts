import blsctJsUrl from 'navio-blsct/wasm/blsct.js?url';
import blsctWasmUrl from 'navio-blsct/wasm/blsct.wasm?url';
import { AUDIT_CONFIG } from './contracts';

let loadPromise: Promise<void> | null = null;

/**
 * Load the BLSCT WASM module under Vite.
 *
 * navio-blsct's bundled loader dynamic-imports blsct.js as ESM, which fails
 * in the browser because Emscripten emits CommonJS. We bypass the failure
 * by (1) pulling blsct.js via a <script> tag so globalThis.BlsctModule is
 * defined, and (2) calling loadBlsctModule with a prefetched wasmBinary —
 * the loader's global-fallback path picks up the factory.
 */
export async function ensureBlsctLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [blsct, wasmBinary] = await Promise.all([
      import('navio-blsct/browser'),
      fetch(blsctWasmUrl).then((r) => r.arrayBuffer()),
      loadScript(blsctJsUrl),
    ]);
    await blsct.loadBlsctModule({ wasmPath: blsctJsUrl, wasmBinary });
    blsct.setChain(AUDIT_CONFIG.network === 'testnet' ? blsct.BlsctChain.Testnet : blsct.BlsctChain.Mainnet);
  })();
  return loadPromise;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-blsct="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.blsct = src;
    s.addEventListener('load', () => {
      s.dataset.loaded = '1';
      resolve();
    });
    s.addEventListener('error', () => reject(new Error(`failed to load ${src}`)));
    document.head.appendChild(s);
  });
}
