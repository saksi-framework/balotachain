package main

import (
	"encoding/hex"
	"testing"

	pb "github.com/saksi-framework/saksi/packages/saksi-protocol/go/saksiprotocolv1"
	"google.golang.org/protobuf/proto"
)

func mustHex(t *testing.T, m proto.Message) string {
	t.Helper()
	raw, err := proto.Marshal(m)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return hex.EncodeToString(raw)
}

func TestBuildBulletin_EmptyInputs(t *testing.T) {
	b, err := BuildBulletin("", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if b.Version != 1 || b.Election != nil || b.Tally != nil {
		t.Fatalf("expected empty bulletin, got %+v", b)
	}
	if b.Voters == nil || b.Ballots == nil {
		t.Fatal("slices must be non-nil for JSON []")
	}
}

func TestBuildBulletin_MapsElection(t *testing.T) {
	params := &pb.ElectionParameters{
		Version:    pb.WireVersion,
		ElectionId: "bc-2028-ph",
		ContestIds: []string{"president", "vp"},
		TrusteeIds: []string{"t01", "t02", "t03", "t04", "t05"},
		Threshold:  3,
	}
	b, err := BuildBulletin(mustHex(t, params), "", "open")
	if err != nil {
		t.Fatal(err)
	}
	e := b.Election
	if e == nil {
		t.Fatal("election nil")
	}
	if e.ID != "bc-2028-ph" || e.Threshold != 3 {
		t.Fatalf("bad election: %+v", e)
	}
	if len(e.Trustees) != 5 || e.Trustees[0].ID != "t01" {
		t.Fatalf("bad trustees: %+v", e.Trustees)
	}
	if len(e.Positions) != 2 || e.Positions[0].ID != "president" || e.Positions[0].Pick != 1 {
		t.Fatalf("bad positions: %+v", e.Positions)
	}
}

func TestBuildBulletin_MapsTally(t *testing.T) {
	params := &pb.ElectionParameters{
		Version:    pb.WireVersion,
		ElectionId: "e1",
		ContestIds: []string{"president"},
		TrusteeIds: []string{"t01", "t02", "t03"},
		Threshold:  2,
	}
	tally := &pb.TallyResult{
		Version:    pb.WireVersion,
		ElectionId: "e1",
		Totals:     []uint64{10, 25, 7},
		PartialDecryptions: []*pb.PartialDecryption{
			{TrusteeId: "t01"}, {TrusteeId: "t02"}, {TrusteeId: "t01"},
		},
	}
	b, err := BuildBulletin(mustHex(t, params), mustHex(t, tally), "closed")
	if err != nil {
		t.Fatal(err)
	}
	if b.Tally == nil {
		t.Fatal("tally nil")
	}
	race, ok := b.Tally.Results["president"]
	if !ok {
		t.Fatalf("expected race keyed by contest id; got keys %v", keys(b.Tally.Results))
	}
	if len(race.Candidates) != 3 {
		t.Fatalf("want 3 candidates, got %d", len(race.Candidates))
	}
	if race.Candidates[1].Votes != 25 || !race.Candidates[1].Elected {
		t.Fatalf("candidate 1 should be elected winner with 25 votes: %+v", race.Candidates[1])
	}
	if race.Candidates[0].Elected || race.Candidates[2].Elected {
		t.Fatal("only the top candidate should be elected")
	}
	if b.Tally.TrusteesSigned != 2 {
		t.Fatalf("want 2 distinct trustees signed, got %d", b.Tally.TrusteesSigned)
	}
	if b.Tally.TrusteesTotal != 3 {
		t.Fatalf("want 3 trustees total, got %d", b.Tally.TrusteesTotal)
	}
	if len(b.Tally.Fingerprint) != len("sha256:")+64 {
		t.Fatalf("bad fingerprint: %q", b.Tally.Fingerprint)
	}
}

func keys(m map[string]RaceResult) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
