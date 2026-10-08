package main

// Stream-dir (offline) mutators: rewrite a saksi-demo --stream dirs header.json
// so `saksi-demo audit-stream <dir> --json` can be shown to reject the same
// mutation the live chaincode committed (B4, A1) or accepted as legacy (B3).
import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func mutateHeader(dir string, fn func(map[string]any)) {
	path := filepath.Join(dir, "header.json")
	raw, err := os.ReadFile(path)
	must(err, "read header.json")
	var h map[string]any
	must(json.Unmarshal(raw, &h), "parse header.json")
	fn(h)
	out, err := json.MarshalIndent(h, "", "  ")
	must(err, "encode header.json")
	must(os.WriteFile(path, out, 0o644), "write header.json")
}

// handleStream handles stream-* subcommands (arg is a stream dir). Returns true
// if it handled the command.
func handleStream(cmd, dir string) bool {
	switch cmd {
	case "stream-dkg":
		mutateHeader(dir, func(h map[string]any) {
			h["dkg"] = tamperDKGCommitment(h["dkg"].(string))
		})
		fmt.Printf("== stream-dkg | %s ==\n  header.json dkg tampered (trustee0 coeff-commitment[0] low bit)\n", dir)
	case "stream-partial":
		mutateHeader(dir, func(h map[string]any) {
			arr := h["partial_decryptions"].([]any)
			arr[0] = tamperPartialProof(arr[0].(string))
			h["partial_decryptions"] = arr
		})
		fmt.Printf("== stream-partial | %s ==\n  header.json partial_decryptions[0] CP response tampered\n", dir)
	case "stream-legacy":
		mutateHeader(dir, func(h map[string]any) {
			h["params"] = zeroIssuer(h["params"].(string))
		})
		fmt.Printf("== stream-legacy | %s ==\n  header.json params issuer_public_key cleared (legacy election)\n", dir)
	default:
		return false
	}
	return true
}
