#!/usr/bin/env bash
# Thesis study (AX42): store big ballot files zstd-compressed, losslessly. Same as the desktop's
# ~/ch4/zpack.sh except -T8 (it runs between runs, never in a ballot window).
# Per file: sha256 of the original into <file>.sha256, zstd -6, zstd -t, then a full
# decompress-and-hash check against the recorded sha256; only then the original is removed.
set -u
total=0
for f in "$@"; do
  [ -f "$f" ] || { echo "skip (absent) $f"; continue; }
  sz=$(stat -c %s "$f")
  (cd "$(dirname "$f")" && sha256sum "$(basename "$f")" > "$(basename "$f").sha256") || { echo "FAIL sha $f"; continue; }
  want=$(cut -d' ' -f1 "$f.sha256")
  zstd -q -f -T8 -6 "$f" -o "$f.zst" || { echo "FAIL zstd $f"; rm -f "$f.zst"; continue; }
  zstd -q -t "$f.zst" || { echo "FAIL test $f"; rm -f "$f.zst"; continue; }
  got=$(zstd -q -dc "$f.zst" | sha256sum | cut -d' ' -f1)
  [ "$got" = "$want" ] || { echo "FAIL hash $f"; rm -f "$f.zst"; continue; }
  zs=$(stat -c %s "$f.zst")
  rm -f "$f"
  total=$((total + sz - zs))
  echo "ok $f $sz -> $zs ratio $(awk "BEGIN{printf \"%.4f\", $zs/$sz}") sha256 $want"
done
echo "freed $total bytes"
