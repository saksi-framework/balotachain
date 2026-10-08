// tamper_invoke — Track N run-tooling (saksi 4a38a54, AX42).
//
// Drives the live saksi-bulletin chaincode (channel "saksi") through the
// election lifecycle from a saksi-demo bundle, injecting one tampered artifact
// per subcommand, and reports whether the ledger committed or refused it (and
// the "gate=<id>:" when refused). Reuses the saksi client-sdk + protobuf and
// the exact mutation functions from saksi-campaign/scenarios.go, so an attack
// is the same byte-level mutation the auditor is already proven to catch.
//
// NOTE: the plan names this tamper_invoke.py. Python was infeasible on the host
// (no protoc / no python-protobuf), and a Go tool reuses saksis own canonical
// proto library and mutation code verbatim — higher fidelity, zero new deps.
// This is the documented honest variant. It produces/submits hex for the live
// chaincode exactly as a `peer invoke` would; offline detection is shown by
// running `saksi-demo audit-stream` on the matching stream dir (see runners).
//
// Subcommands (bundle = `saksi-demo gen ... <bundle.json>`):
//   b4   <bundle>            CreateElection + PublishDKGTranscript(tampered DKG) — expect COMMIT (shape-only)
//   a1   <bundle>            lifecycle→close, SubmitPartialDecryption(tampered CP proof) — expect COMMIT
//   a2   <bundle>            lifecycle→partials, PublishTally(<threshold signatures) — expect REFUSED
//   a3   <bundle>            lifecycle→partials, PublishTally(one total flipped) — expect REFUSED
//   b3   <bundle>            CreateElection(empty issuer key)+DKG+ballot — expect COMMIT (legacy, issuer gate skipped)
//   b1   <bundle>            CreateElection as org2 then as org1 (same id) — expect 2nd REFUSED (already exists)
//
// Flags: --org1-msp, --org2-msp, --peer-endpoint, --gateway-peer, --tls-cert,
// --channel, --chaincode (sane test-network defaults).
package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	clientsdk "github.com/saksi-framework/saksi/packages/saksi-bulletin/client-sdk"
	pb "github.com/saksi-framework/saksi/packages/saksi-protocol/go/saksiprotocolv1"
	"google.golang.org/protobuf/proto"
)

type bundle struct {
	ElectionID         string   `json:"election_id"`
	Params             string   `json:"params"`
	DKG                string   `json:"dkg"`
	IssuerPK           string   `json:"issuer_pk"`
	BindingContext     string   `json:"binding_context"`
	Ballots            []string `json:"ballots"`
	PartialDecryptions []string `json:"partial_decryptions"`
	Tally              string   `json:"tally"`
}

var (
	peerEndpoint = "localhost:7051"
	gatewayPeer  = "peer0.org1.example.com"
	tlsCert      = "/root/Code/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
	org1MSPdir   = "/root/Code/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp"
	org2MSPdir   = "/root/Code/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp"
	channel      = "saksi"
	chaincode    = "saksi-bulletin"
)

func mspConn(mspdir, mspid string) clientsdk.ConnectionConfig {
	cert := firstFile(filepath.Join(mspdir, "signcerts"))
	key := firstFile(filepath.Join(mspdir, "keystore"))
	return clientsdk.ConnectionConfig{
		PeerEndpoint: peerEndpoint, GatewayPeer: gatewayPeer, TLSCertPath: tlsCert,
		MSPID: mspid, CertPath: cert, KeyPath: key, Channel: channel, Chaincode: chaincode,
	}
}

func firstFile(dir string) string {
	es, err := os.ReadDir(dir)
	if err != nil {
		fatal("read %s: %v", dir, err)
	}
	for _, e := range es {
		if !e.IsDir() {
			return filepath.Join(dir, e.Name())
		}
	}
	fatal("no file in %s", dir)
	return ""
}

func fatal(f string, a ...any) { fmt.Fprintf(os.Stderr, "ERROR: "+f+"\n", a...); os.Exit(1) }

func loadBundle(path string) bundle {
	raw, err := os.ReadFile(path)
	if err != nil {
		fatal("read bundle: %v", err)
	}
	var b bundle
	if err := json.Unmarshal(raw, &b); err != nil {
		fatal("parse bundle: %v", err)
	}
	return b
}

func connect(cfg clientsdk.ConnectionConfig) *clientsdk.Connection {
	c, err := clientsdk.Connect(cfg)
	if err != nil {
		fatal("connect: %v", err)
	}
	return c
}

// step runs one chaincode call and prints COMMIT / REFUSED with the gate text.
func step(name string, err error) bool {
	if err == nil {
		fmt.Printf("  [COMMIT]  %s\n", name)
		return true
	}
	fmt.Printf("  [REFUSED] %s -> %s\n", name, clientsdk.ErrorText(err))
	return false
}

// ---- proto decode/encode + mutations (verbatim from scenarios.go) ----

func decodeHexProto(h string, m proto.Message) error {
	raw, err := hex.DecodeString(h)
	if err != nil {
		return fmt.Errorf("not hex: %w", err)
	}
	return proto.Unmarshal(raw, m)
}

func encodeHexProto(m proto.Message) (string, error) {
	enc, err := proto.Marshal(m)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(enc), nil
}

func tamperDKGCommitment(h string) string {
	var t pb.DKGTranscript
	must(decodeHexProto(h, &t), "decode dkg")
	if len(t.GetTrusteeCommitments()) == 0 || len(t.TrusteeCommitments[0].GetCoefficientCommitments()) == 0 ||
		len(t.TrusteeCommitments[0].CoefficientCommitments[0]) == 0 {
		fatal("dkg has no coefficient commitment to tamper")
	}
	t.TrusteeCommitments[0].CoefficientCommitments[0][0] ^= 0x01
	out, err := encodeHexProto(&t)
	must(err, "encode dkg")
	return out
}

func tamperPartialProof(h string) string {
	var pd pb.PartialDecryption
	must(decodeHexProto(h, &pd), "decode partial")
	if len(pd.GetProof().GetResponse()) == 0 {
		fatal("partial has no Chaum-Pedersen response to tamper")
	}
	pd.Proof.Response[0] ^= 0x01
	out, err := encodeHexProto(&pd)
	must(err, "encode partial")
	return out
}

func zeroIssuer(h string) string {
	var p pb.ElectionParameters
	must(decodeHexProto(h, &p), "decode params")
	p.IssuerPublicKey = nil
	out, err := encodeHexProto(&p)
	must(err, "encode params")
	return out
}

func stripTallySignatures(h string, keep int) (string, int) {
	var t pb.TallyResult
	must(decodeHexProto(h, &t), "decode tally")
	n := len(t.GetSignatures())
	if keep > n {
		keep = n
	}
	t.Signatures = t.Signatures[:keep]
	out, err := encodeHexProto(&t)
	must(err, "encode tally")
	return out, n
}

func flipTallyTotal(h string) (string, uint64, uint64) {
	var t pb.TallyResult
	must(decodeHexProto(h, &t), "decode tally")
	if len(t.GetTotals()) == 0 {
		fatal("tally has no totals to flip")
	}
	old := t.Totals[0]
	t.Totals[0] = old + 1
	out, err := encodeHexProto(&t)
	must(err, "encode tally")
	return out, old, t.Totals[0]
}

func must(err error, ctx string) {
	if err != nil {
		fatal("%s: %v", ctx, err)
	}
}

// ---- lifecycle helpers ----

func create(c *clientsdk.Connection, paramsHex string) error {
	return c.Bulletin.CreateElection(paramsHex)
}
func publishDKG(c *clientsdk.Connection, dkgHex string) error {
	return c.Bulletin.PublishDKGTranscript(dkgHex)
}
func submitBallots(c *clientsdk.Connection, b bundle) {
	for i, h := range b.Ballots {
		if err := c.Bulletin.SubmitBallot(h); err != nil {
			fatal("ballot %d unexpectedly refused: %s", i, clientsdk.ErrorText(err))
		}
	}
	fmt.Printf("  [setup]   %d ballots committed\n", len(b.Ballots))
}
func closeElection(c *clientsdk.Connection, id string) {
	if err := c.Bulletin.CloseElection(id); err != nil {
		fatal("close: %s", clientsdk.ErrorText(err))
	}
	fmt.Printf("  [setup]   election closed\n")
}
func submitPartials(c *clientsdk.Connection, b bundle) {
	for i, h := range b.PartialDecryptions {
		if err := c.Bulletin.SubmitPartialDecryption(b.ElectionID, h); err != nil {
			fatal("partial %d unexpectedly refused: %s", i, clientsdk.ErrorText(err))
		}
	}
	fmt.Printf("  [setup]   %d partial decryptions committed\n", len(b.PartialDecryptions))
}
func setupToClose(c *clientsdk.Connection, b bundle) {
	if err := create(c, b.Params); err != nil {
		fatal("create: %s", clientsdk.ErrorText(err))
	}
	if err := publishDKG(c, b.DKG); err != nil {
		fatal("publish dkg: %s", clientsdk.ErrorText(err))
	}
	submitBallots(c, b)
	closeElection(c, b.ElectionID)
}

func main() {
	if len(os.Args) < 3 {
		fatal("usage: tamper_invoke <b1|b3|b4|a1|a2|a3> <bundle.json>")
	}
	cmd, bundlePath := os.Args[1], os.Args[2]
	if handleStream(cmd, bundlePath) {
		return
	}
	if cmd == "submit-raw" {
		runSubmitRaw(os.Args[2:])
		return
	}
	b := loadBundle(bundlePath)
	fmt.Printf("== %s | election=%s ==\n", cmd, b.ElectionID)

	switch cmd {
	case "b4": // tampered DKG transcript committed live (shape-only), auditor dkg.decode offline
		c := connect(mspConn(org1MSPdir, "Org1MSP"))
		defer c.Close()
		step("CreateElection", create(c, b.Params))
		td := tamperDKGCommitment(b.DKG)
		fmt.Printf("  dkg tampered: trustee0 coeff-commitment[0] low bit flipped (not a valid ristretto point)\n")
		step("PublishDKGTranscript(tampered)", publishDKG(c, td))

	case "a1": // tampered partial CP proof committed live (shape-only), auditor decryption.cp_proof offline
		c := connect(mspConn(org1MSPdir, "Org1MSP"))
		defer c.Close()
		setupToClose(c, b)
		if len(b.PartialDecryptions) == 0 {
			fatal("bundle has no partial decryptions")
		}
		tp := tamperPartialProof(b.PartialDecryptions[0])
		fmt.Printf("  partial[0] tampered: Chaum-Pedersen response low bit flipped (well-formed, does not verify)\n")
		step("SubmitPartialDecryption(tampered)", c.Bulletin.SubmitPartialDecryption(b.ElectionID, tp))

	case "a2": // PublishTally with < threshold valid signatures -> refused
		c := connect(mspConn(org1MSPdir, "Org1MSP"))
		defer c.Close()
		setupToClose(c, b)
		submitPartials(c, b)
		th, total := stripTallySignatures(b.Tally, 2)
		fmt.Printf("  tally signatures stripped: kept 2 of %d (threshold is 3)\n", total)
		step("PublishTally(2 signatures)", c.Bulletin.PublishTally(th))

	case "a3": // PublishTally with one total flipped -> refused (signatures bind the totals)
		c := connect(mspConn(org1MSPdir, "Org1MSP"))
		defer c.Close()
		setupToClose(c, b)
		submitPartials(c, b)
		th, old, nw := flipTallyTotal(b.Tally)
		fmt.Printf("  tally totals[0] flipped %d -> %d, signatures left intact\n", old, nw)
		step("PublishTally(flipped total)", c.Bulletin.PublishTally(th))

	case "b3": // legacy election (empty issuer key): self-issued ballot accepted on-chain
		c := connect(mspConn(org1MSPdir, "Org1MSP"))
		defer c.Close()
		zp := zeroIssuer(b.Params)
		fmt.Printf("  params issuer_public_key cleared (legacy election; issuer gate skipped)\n")
		if !step("CreateElection(empty issuer)", create(c, zp)) {
			return
		}
		step("PublishDKGTranscript", publishDKG(c, b.DKG))
		if len(b.Ballots) > 0 {
			step("SubmitBallot(self-issued, legacy)", c.Bulletin.SubmitBallot(b.Ballots[0]))
		}

	case "b1": // front-run: org2 creates first, honest org1 locked out (no caller auth)
		attacker := connect(mspConn(org2MSPdir, "Org2MSP"))
		defer attacker.Close()
		honest := connect(mspConn(org1MSPdir, "Org1MSP"))
		defer honest.Close()
		fmt.Printf("  attacker = Org2MSP/User1 front-runs CreateElection\n")
		step("CreateElection [Org2MSP attacker]", create(attacker, b.Params))
		fmt.Printf("  honest = Org1MSP/User1 now tries the same election id\n")
		step("CreateElection [Org1MSP honest]", create(honest, b.Params))

	default:
		fatal("unknown subcommand %q", cmd)
	}
}
