# Provenance of the vendored @saksi/wasm package

These files are copied unchanged from a saksi build. Do not edit them;
re-sync with `tools/sync-saksi-wasm.sh /path/to/saksi` instead.

- Package: `@saksi/wasm` 0.1.0
- Built at saksi commit: `6d2555f` (`6d2555f3d99e7ad85728d4badb10cf9f49c8ac21`)
- Build command (in the saksi checkout): `tools/live/build-wasm.sh`
- Source: `packages/saksi-wasm/pkg/` of that build (the `web` target)
- Wire format: saksi `docs/live/wire-format.md`, section "WebAssembly (phone)"
- After each re-sync, run the issuance tests once with the same build's CLI:
  `SAKSI_DEMO=/path/to/saksi-demo pnpm --filter vote exec vitest run src/lib/real.test.ts`

| File | Bytes | SHA-256 |
|---|---:|---|
| `package.json` | 707 | `c6ddd47c7848f550353adfc2326a40c650fd47a616fcb863668ebdb2cc8fb65c` |
| `index.js` | 1763 | `dd48f7be614e5f78efd37200ef9430eea4bb15b9e285c7d0ec967bb37118ce54` |
| `index.d.ts` | 1205 | `1b6dd88cde20486f2895a88c16df8f656cbdb17a9bea71540cd7ff21f2df1ec9` |
| `wire.d.ts` | 4503 | `d3f8388a3ec369f6ac603174b47905a986020595ba6333a52a99adf49eec88ce` |
| `saksi_wasm.js` | 15885 | `6ceb96b482fc48ca98a325b5d00c05ec8d1aca16b01f0623716c1337e9e75587` |
| `saksi_wasm.d.ts` | 3870 | `1b16b33e80d260467e757fdbd01fd487b8f075faf25404bca728dd8c00b8f421` |
| `saksi_wasm_bg.wasm` | 486243 | `1f0ab1d569b3e92d23994ca9a091f126fce2add8bb064d58acdb0b21a3fb74ac` |
| `saksi_wasm_bg.wasm.d.ts` | 1340 | `2cd1cc28b56f933e755aa2f26a65cdc8b07a493b3a6f5fb02f32589f15d37116` |
