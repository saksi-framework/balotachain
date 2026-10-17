package main

// submit-raw: submit one hex ballot with an arbitrary identity (cert/key/msp),
// reporting COMMIT or REFUSED + the gate text (via ErrorText). Serves B2 (a
// cert from a CA not on the channel) and D2 (replay of a committed ballot).
import (
	"flag"
	"fmt"
	"os"
	"strings"

	clientsdk "github.com/saksi-framework/saksi/packages/saksi-bulletin/client-sdk"
)

func runSubmitRaw(args []string) {
	fs := flag.NewFlagSet("submit-raw", flag.ExitOnError)
	ballot := fs.String("ballot", "", "path to a hex ballot file (required)")
	cert := fs.String("cert", "", "identity certificate PEM (default: org1 User1)")
	key := fs.String("key", "", "identity private key PEM (default: org1 User1)")
	msp := fs.String("msp", "Org1MSP", "MSP id to claim")
	label := fs.String("label", "SubmitBallot", "label for the report line")
	chanF := fs.String("channel", "", "channel to target (default: SAKSI_CHANNEL or saksi)")
	ccF := fs.String("chaincode", "", "chaincode name (default: SAKSI_CHAINCODE or saksi-bulletin)")
	_ = fs.String("election", "", "election id the ballot belongs to (recorded only; the id is inside the ballot)")
	_ = fs.Parse(args)
	if *ballot == "" {
		fatal("submit-raw: --ballot is required")
	}
	raw, err := os.ReadFile(*ballot)
	must(err, "read ballot")
	h := strings.TrimSpace(string(raw))

	cfg := mspConn(org1MSPdir, "Org1MSP")
	if *cert != "" {
		cfg.CertPath = *cert
	}
	if *key != "" {
		cfg.KeyPath = *key
	}
	cfg.MSPID = *msp
	if *chanF != "" {
		cfg.Channel = *chanF
	}
	if *ccF != "" {
		cfg.Chaincode = *ccF
	}

	c, err := clientsdk.Connect(cfg)
	if err != nil {
		fmt.Printf("  [REFUSED] %s (at connect) -> %s\n", *label, clientsdk.ErrorText(err))
		return
	}
	defer c.Close()
	step(*label, c.Bulletin.SubmitBallot(h))
}
