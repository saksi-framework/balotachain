/* tslint:disable */
/* eslint-disable */

/**
 * Voter issuance step 1: `{"blinded_commitment", "state"}`. `state` is
 * secret.
 */
export function begin_issuance(): string;

/**
 * `{"params", "dkg", "ballot", "opened"}` -> per-slot verdicts and the
 * candidate the ballot encodes.
 */
export function benaloh_check(input: string): string;

/**
 * `{"ballot", "opening"}` -> the opened values of a challenged ballot.
 */
export function benaloh_open(input: string): string;

/**
 * Voter issuance step 2 (`voter-blind`): `{"state", "r",
 * "issuer_public_key"}` -> `{"e_prime", "state"}`.
 */
export function blind_challenge(input: string): string;

/**
 * The CLI `ballot` input -> its output plus `opening` (secret).
 */
export function build_ballot(input: string): string;

/**
 * `{"params", "credential"}` -> `{"usable": true, "election_id",
 * "issuer_public_key", "commitment"}`; throws for a credential this
 * election's issuer did not sign.
 */
export function check_credential(input: string): string;

/**
 * `{"params", "dkg"}` -> positions, trustees and the joint key with its
 * fingerprint.
 */
export function election_info(input: string): string;

/**
 * Voter issuance step 3 (`voter-finalize`): `{"state", "s_iss",
 * "issuer_public_key"}` -> `{"credential", "commitment"}`.
 */
export function finalize_issuance(input: string): string;

/**
 * `{"nullifier"}` -> `{"tracking_code"}`.
 */
export function tracking_code(input: string): string;

/**
 * `{"name", "version", "wire_format", "protocol_wire_version", "git_rev"}`.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly begin_issuance: () => [number, number, number];
    readonly benaloh_check: (a: number, b: number) => [number, number, number];
    readonly benaloh_open: (a: number, b: number) => [number, number, number];
    readonly blind_challenge: (a: number, b: number) => [number, number, number];
    readonly build_ballot: (a: number, b: number) => [number, number, number];
    readonly check_credential: (a: number, b: number) => [number, number, number];
    readonly election_info: (a: number, b: number) => [number, number, number];
    readonly finalize_issuance: (a: number, b: number) => [number, number, number];
    readonly tracking_code: (a: number, b: number) => [number, number, number];
    readonly version: () => [number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
