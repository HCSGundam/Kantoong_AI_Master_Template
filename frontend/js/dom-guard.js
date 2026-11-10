/**
 * KANTOONG — PENGAMAN "null" DI LAYAR (dimuat lewat theme.js di semua halaman)
 * File: frontend/js/dom-guard.js
 *
 * Browser menulis teks "null"/"undefined"/"false" bila bagian opsional
 * (cond ? x : null) dimasukkan langsung ke append/prepend/replaceChildren/before/after.
 * Pengaman ini menyaring nilai kosong itu di SEMUA halaman sekaligus,
 * jadi bug kelas ini tidak bisa muncul lagi di fitur mana pun.
 */

export const isEmptyPart = (node) => node === null || node === undefined || node === false;

export function installDomGuard(root = globalThis) {
    const targets = [root.Element?.prototype, root.DocumentFragment?.prototype, root.Document?.prototype].filter(Boolean);
    for (const proto of targets) {
        for (const name of ["append", "prepend", "replaceChildren", "before", "after", "replaceWith"]) {
            const original = proto[name];
            if (typeof original !== "function" || original.__kcGuard) continue;
            const guarded = function guardedInsert(...nodes) {
                return original.apply(this, nodes.filter((n) => !isEmptyPart(n)));
            };
            guarded.__kcGuard = true;
            Object.defineProperty(proto, name, { value: guarded, configurable: true, writable: true });
        }
    }
}

if (typeof Element !== "undefined") installDomGuard();
