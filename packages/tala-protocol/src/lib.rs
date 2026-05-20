#![doc = "Canonical BalotaChain and Tala protocol wire types."]

use prost::Message;
use sha2::{Digest, Sha256};

pub mod v1 {
    include!(concat!(env!("OUT_DIR"), "/tala.protocol.v1.rs"));
}

pub use v1::{
    Ballot, CdsProof as CDSProof, CdsProofBranch as CDSProofBranch, ChaumPedersenProof, Ciphertext,
    CredentialPresentation, DkgComplaint as DKGComplaint, DkgTranscript as DKGTranscript,
    ElectionParameters, Nullifier, PartialDecryption, PedersenCommitment, TallyResult,
    TrusteeCommitment,
};

pub const WIRE_VERSION: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("protobuf decode failed: {0}")]
    Decode(#[from] prost::DecodeError),
}

pub fn encode<M>(message: &M) -> Vec<u8>
where
    M: Message,
{
    message.encode_to_vec()
}

pub fn decode<M>(bytes: &[u8]) -> Result<M, ProtocolError>
where
    M: Message + Default,
{
    Ok(M::decode(bytes)?)
}

pub fn domain_hash(domain: &'static [u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"tala-protocol-v1");
    hasher.update((domain.len() as u64).to_be_bytes());
    hasher.update(domain);

    for part in parts {
        hasher.update((part.len() as u64).to_be_bytes());
        hasher.update(part);
    }

    hasher.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_ballot() -> Ballot {
        Ballot {
            version: WIRE_VERSION,
            election_id: "election-2026".to_owned(),
            voter_credential_commitment: vec![1, 2, 3],
            ciphertexts: vec![Ciphertext {
                version: WIRE_VERSION,
                pad: vec![4; 32],
                data: vec![5; 32],
            }],
            well_formedness_proofs: vec![CDSProof {
                version: WIRE_VERSION,
                branches: vec![CDSProofBranch {
                    commitment_a: vec![6; 32],
                    commitment_b: vec![7; 32],
                    challenge: vec![8; 32],
                    response: vec![9; 32],
                }],
            }],
            credential_presentation: Some(CredentialPresentation {
                version: WIRE_VERSION,
                credential_commitment: vec![10; 32],
                issuer_public_key: vec![11; 32],
                presentation_proof: vec![12; 64],
                nullifier: Some(Nullifier {
                    version: WIRE_VERSION,
                    value: vec![13; 32],
                }),
            }),
        }
    }

    #[test]
    fn ballot_round_trips() {
        let ballot = sample_ballot();
        let bytes = encode(&ballot);
        let decoded: Ballot = decode(&bytes).expect("ballot should decode");
        assert_eq!(decoded, ballot);
    }

    #[test]
    fn domain_hash_is_domain_separated() {
        let first = domain_hash(b"ballot", &[b"abc"]);
        let second = domain_hash(b"credential", &[b"abc"]);
        assert_ne!(first, second);
    }

    #[test]
    fn ballot_test_vector_is_stable() {
        let bytes = encode(&sample_ballot());
        assert_eq!(
            hex_lower(&bytes),
            include_str!("../test-vectors/ballot-v1.hex").trim()
        );
    }

    fn hex_lower(bytes: &[u8]) -> String {
        const TABLE: &[u8; 16] = b"0123456789abcdef";
        let mut out = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            out.push(TABLE[(byte >> 4) as usize] as char);
            out.push(TABLE[(byte & 0x0f) as usize] as char);
        }
        out
    }
}
