package main

// publish-tally: submit one signed tally (hex) to the chaincode, reporting
// COMMIT or REFUSED + the gate text. Serves T20 (cross-precinct tally replay):
// publish precinct p03's trustee-signed tally while targeting p04. The tally
// proto carries its own election id, so the chaincode decides which election it
// belongs to; a replay onto another precinct's election is refused on chain,
// and this records that outcome for the paper.
import (
	"flag"
	"os"
	"strings"

	clientsdk "github.com/saksi-framework/saksi/packages/saksi-bulletin/client-sdk"
)

func runPublishTally(args []string) {
	fs := flag.NewFlagSet("publish-tally", flag.ExitOnError)
	tallyHex := fs.String("tally-hex", "", "the signed tally as hex (inline)")
	tallyFile := fs.String("tally", "", "path to a file holding the signed tally hex")
	label := fs.String("label", "PublishTally", "label for the report line")
	chanF := fs.String("channel", "", "channel to target (default: SAKSI_CHANNEL or saksi)")
	ccF := fs.String("chaincode", "", "chaincode name (default: SAKSI_CHAINCODE or saksi-bulletin)")
	_ = fs.String("election", "", "election id being targeted (recorded only; the id is inside the tally)")
	_ = fs.Parse(args)

	h := strings.TrimSpace(*tallyHex)
	if h == "" {
		if *tallyFile == "" {
			fatal("publish-tally: --tally-hex or --tally is required")
		}
		raw, err := os.ReadFile(*tallyFile)
		must(err, "read tally")
		h = strings.TrimSpace(string(raw))
	}

	cfg := mspConn(org1MSPdir, "Org1MSP")
	if *chanF != "" {
		cfg.Channel = *chanF
	}
	if *ccF != "" {
		cfg.Chaincode = *ccF
	}
	c, err := clientsdk.Connect(cfg)
	must(err, "connect")
	defer c.Close()
	step(*label, c.Bulletin.PublishTally(h))
}
