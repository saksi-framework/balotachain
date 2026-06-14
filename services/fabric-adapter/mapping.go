// Package main maps the saksi on-chain protobuf wire types into the BalotaChain
// bulletin JSON schema (docs/bulletin-store-schema.md), so a balotachain client
// (auditor / bulletin board) can read a REAL on-chain election by pointing at
// this adapter via BALOTA_BULLETIN_URL.
//
// This is a READ-path mapping. The chaincode wire types are crypto-lean — they
// carry election/contest/trustee ids, threshold, and per-candidate vote totals,
// but NOT the UI metadata BalotaChain renders (candidate names, parties, dates,
// joint key). Those fields are filled with honest placeholders derived from the
// on-chain ids; the numbers (totals, threshold, trustee counts) are real.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	pb "github.com/saksi-framework/saksi/packages/saksi-protocol/go/saksiprotocolv1"
	"google.golang.org/protobuf/proto"
)

// ---- BalotaChain bulletin JSON schema (mirrors crates/bulletin-store) ----

type Bulletin struct {
	Version            int           `json:"version"`
	Election           *Election     `json:"election"`
	Voters             []any         `json:"voters"`
	Credentials        []any         `json:"credentials"`
	Ballots            []any         `json:"ballots"`
	PartialDecryptions []any         `json:"partial_decryptions"`
	Tally              *Tally        `json:"tally"`
}

type Election struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Opens          string         `json:"opens"`
	Closes         string         `json:"closes"`
	JointPublicKey string         `json:"joint_public_key"`
	Trustees       []TrusteeEntry `json:"trustees"`
	Threshold      uint32         `json:"threshold"`
	Positions      []Position     `json:"positions"`
}

type TrusteeEntry struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PublicShare string `json:"public_share"`
}

type Position struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Pick  uint32 `json:"pick"`
}

type Tally struct {
	Results        map[string]RaceResult `json:"results"`
	Fingerprint    string                `json:"fingerprint"`
	TrusteesSigned uint32                `json:"trustees_signed"`
	TrusteesTotal  uint32                `json:"trustees_total"`
	ClosedAt       string                `json:"closed_at"`
}

type RaceResult struct {
	Candidates []CandidateResult `json:"candidates"`
}

type CandidateResult struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Party   string `json:"party"`
	Votes   uint64 `json:"votes"`
	Elected bool   `json:"elected"`
}

// EmptyBulletin matches Bulletin::empty() in the Rust crate.
func EmptyBulletin() *Bulletin {
	return &Bulletin{
		Version:            1,
		Voters:             []any{},
		Credentials:        []any{},
		Ballots:            []any{},
		PartialDecryptions: []any{},
	}
}

// BuildBulletin assembles a BalotaChain bulletin from the chaincode's hex-encoded
// ElectionParameters and TallyResult (either may be empty when absent on-chain).
// `status` is the plain election status string ("open"/"closed"); currently
// informational.
func BuildBulletin(electionHex, tallyHex, status string) (*Bulletin, error) {
	b := EmptyBulletin()

	if electionHex != "" {
		params, err := decodeElection(electionHex)
		if err != nil {
			return nil, err
		}
		b.Election = electionFromParams(params)
	}

	if tallyHex != "" {
		tally, raw, err := decodeTally(tallyHex)
		if err != nil {
			return nil, err
		}
		b.Tally = tallyFromResult(tally, raw, b.Election)
	}

	return b, nil
}

func decodeElection(electionHex string) (*pb.ElectionParameters, error) {
	raw, err := hex.DecodeString(electionHex)
	if err != nil {
		return nil, fmt.Errorf("election hex: %w", err)
	}
	var params pb.ElectionParameters
	if err := proto.Unmarshal(raw, &params); err != nil {
		return nil, fmt.Errorf("decode ElectionParameters: %w", err)
	}
	return &params, nil
}

func decodeTally(tallyHex string) (*pb.TallyResult, []byte, error) {
	raw, err := hex.DecodeString(tallyHex)
	if err != nil {
		return nil, nil, fmt.Errorf("tally hex: %w", err)
	}
	var tally pb.TallyResult
	if err := proto.Unmarshal(raw, &tally); err != nil {
		return nil, nil, fmt.Errorf("decode TallyResult: %w", err)
	}
	return &tally, raw, nil
}

func electionFromParams(p *pb.ElectionParameters) *Election {
	el := &Election{
		ID:        p.GetElectionId(),
		Name:      "On-chain election " + p.GetElectionId(),
		Threshold: p.GetThreshold(),
	}
	for _, tid := range p.GetTrusteeIds() {
		el.Trustees = append(el.Trustees, TrusteeEntry{ID: tid, Name: tid})
	}
	for _, cid := range p.GetContestIds() {
		el.Positions = append(el.Positions, Position{ID: cid, Label: cid, Pick: 1})
	}
	return el
}

func tallyFromResult(t *pb.TallyResult, raw []byte, election *Election) *Tally {
	// One race, keyed by the first contest id (or "tally"), with generic
	// candidate labels — names/parties are not on-chain.
	raceKey := "tally"
	if election != nil && len(election.Positions) > 0 {
		raceKey = election.Positions[0].ID
	}

	totals := t.GetTotals()
	winner := argmax(totals)
	candidates := make([]CandidateResult, 0, len(totals))
	for i, votes := range totals {
		candidates = append(candidates, CandidateResult{
			ID:      fmt.Sprintf("candidate-%d", i),
			Name:    fmt.Sprintf("Candidate %d", i+1),
			Votes:   votes,
			Elected: i == winner && len(totals) > 0,
		})
	}

	signed := distinctTrustees(t.GetPartialDecryptions())
	var total uint32
	if election != nil {
		total = uint32(len(election.Trustees))
	}

	digest := sha256.Sum256(raw)
	return &Tally{
		Results:        map[string]RaceResult{raceKey: {Candidates: candidates}},
		Fingerprint:    "sha256:" + hex.EncodeToString(digest[:]),
		TrusteesSigned: signed,
		TrusteesTotal:  total,
	}
}

func distinctTrustees(partials []*pb.PartialDecryption) uint32 {
	seen := map[string]struct{}{}
	for _, p := range partials {
		seen[p.GetTrusteeId()] = struct{}{}
	}
	return uint32(len(seen))
}

func argmax(xs []uint64) int {
	best := -1
	var bestVal uint64
	for i, x := range xs {
		if best == -1 || x > bestVal {
			best, bestVal = i, x
		}
	}
	return best
}
