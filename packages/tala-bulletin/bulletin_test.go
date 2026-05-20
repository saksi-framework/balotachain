package bulletin

import "testing"

func TestPackageName(t *testing.T) {
	if got := PackageName(); got != "tala-bulletin" {
		t.Fatalf("PackageName() = %q, want %q", got, "tala-bulletin")
	}
}
