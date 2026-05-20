#![doc = "Placeholder crate for Tala cryptographic primitives."]

/// Returns the package name until real cryptographic APIs are introduced.
pub fn package_name() -> &'static str {
    "tala-crypto"
}

#[cfg(test)]
mod tests {
    use super::package_name;

    #[test]
    fn exposes_package_name() {
        assert_eq!(package_name(), "tala-crypto");
    }
}
