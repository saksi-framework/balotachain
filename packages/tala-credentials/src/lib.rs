#![doc = "Placeholder crate for Tala anonymous credentials."]

/// Returns the package name until real credential APIs are introduced.
pub fn package_name() -> &'static str {
    "tala-credentials"
}

#[cfg(test)]
mod tests {
    use super::package_name;

    #[test]
    fn exposes_package_name() {
        assert_eq!(package_name(), "tala-credentials");
    }
}
