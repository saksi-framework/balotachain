// Command fabric-adapter is a read-only HTTP bridge that lets a BalotaChain
// client view a REAL on-chain election. It connects to a running Fabric network
// via the saksi client-sdk, reads the election + tally, maps them into the
// BalotaChain bulletin JSON schema, and serves them at GET /bulletin — the same
// contract as the file/gateway store, so the auditor/bulletin board works
// unchanged by pointing BALOTA_BULLETIN_URL at this adapter.
//
// It is read-only by design: writing balotachain's demo data on-chain is not
// possible because the chaincode verifies real credential signatures, which the
// demo's stubbed credentials do not produce (see docker/README.md / CLAUDE.md).
//
// Config (env): PEER_ENDPOINT, GATEWAY_PEER, TLS_CERT, CERT, KEY, MSP_ID,
// CHANNEL, CHAINCODE, ELECTION_ID (required), ADDR.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	clientsdk "github.com/saksi-framework/saksi/packages/saksi-bulletin/client-sdk"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	cfg := clientsdk.ConnectionConfig{
		PeerEndpoint: env("PEER_ENDPOINT", "localhost:7051"),
		GatewayPeer:  env("GATEWAY_PEER", "peer0.org1.example.com"),
		TLSCertPath:  os.Getenv("TLS_CERT"),
		MSPID:        env("MSP_ID", "Org1MSP"),
		CertPath:     os.Getenv("CERT"),
		KeyPath:      os.Getenv("KEY"),
		Channel:      env("CHANNEL", "saksi"),
		Chaincode:    env("CHAINCODE", "saksi-bulletin"),
	}
	electionID := os.Getenv("ELECTION_ID")
	addr := env("ADDR", "0.0.0.0:8080")

	if electionID == "" || cfg.TLSCertPath == "" || cfg.CertPath == "" || cfg.KeyPath == "" {
		log.Fatal("ELECTION_ID, TLS_CERT, CERT, and KEY are required")
	}

	conn, err := clientsdk.Connect(cfg)
	if err != nil {
		log.Fatalf("connect to bulletin board: %v", err)
	}
	defer func() { _ = conn.Close() }()
	bc := conn.Bulletin

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/bulletin", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "read-only adapter: only GET /bulletin is supported", http.StatusMethodNotAllowed)
			return
		}
		// Missing election/tally on-chain -> empty strings -> empty sections.
		electionHex, _ := bc.GetElection(electionID)
		tallyHex, _ := bc.GetTally(electionID)
		status, _ := bc.GetElectionStatus(electionID)

		bulletin, err := BuildBulletin(electionHex, tallyHex, status)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(bulletin)
	})

	log.Printf("fabric-adapter listening on http://%s (election=%s channel=%s chaincode=%s)",
		addr, electionID, cfg.Channel, cfg.Chaincode)
	log.Fatal(http.ListenAndServe(addr, mux))
}
