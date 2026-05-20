// Package protocol mirrors the Rust tala-protocol crate so that the Go chaincode
// and Fabric client SDK serialize the same wire types byte-for-byte. The schema
// decision (Protocol Buffers via protoc-gen-go vs. hand-mirrored types) lands in
// issue #7: https://github.com/tala-blockchain/balotachain/issues/7.
package protocol
