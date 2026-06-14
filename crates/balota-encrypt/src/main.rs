//! balota-encrypt CLI.
//!
//! Subcommands:
//!   encrypt        --public-key <hex64> --choice <u64> --randomness <u64>
//!     -> stdout: {"pad":"<hex>","data":"<hex>"}
//!
//!   submit-ballot  --voter-id <id> --token <hex32> --choice <u64>
//!     -> stdout: {"tracking_code":"BC-XXXX-XXXX","submitted_at":"<rfc3339>"}
//!
//! Errors are printed to stdout as {"error":"<msg>"} with a non-zero exit code,
//! which keeps the wire format JSON-only so Dart callers parse a single payload.

use std::collections::HashMap;
use std::process::ExitCode;

use balota_encrypt::{EncryptArgs, SubmitArgs, cli_source, encrypt_impl, submit_ballot_impl};
use serde_json::json;

fn main() -> ExitCode {
    let argv: Vec<String> = std::env::args().collect();
    if argv.len() < 2 {
        return print_err("usage: balota-encrypt <encrypt|submit-ballot> [args...]");
    }
    let sub = argv[1].as_str();
    let flags = match parse_flags(&argv[2..]) {
        Ok(f) => f,
        Err(e) => return print_err(&e),
    };

    match sub {
        "encrypt" => run_encrypt(&flags),
        "submit-ballot" => run_submit(&flags),
        other => print_err(&format!("unknown subcommand: {other}")),
    }
}

fn run_encrypt(flags: &HashMap<String, String>) -> ExitCode {
    let public_key = match required(flags, "public-key") {
        Ok(v) => v,
        Err(e) => return print_err(&e),
    };
    let choice = match required_u64(flags, "choice") {
        Ok(v) => v,
        Err(e) => return print_err(&e),
    };
    let randomness = match required_u64(flags, "randomness") {
        Ok(v) => v,
        Err(e) => return print_err(&e),
    };

    match encrypt_impl(EncryptArgs {
        public_key,
        choice,
        randomness,
    }) {
        Ok(c) => {
            println!("{}", json!({ "pad": c.pad, "data": c.data }));
            ExitCode::SUCCESS
        }
        Err(e) => print_err(&e),
    }
}

fn run_submit(flags: &HashMap<String, String>) -> ExitCode {
    let voter_id = match required(flags, "voter-id") {
        Ok(v) => v,
        Err(e) => return print_err(&e),
    };
    let token = match required(flags, "token") {
        Ok(v) => v,
        Err(e) => return print_err(&e),
    };
    let choice = match required_u64(flags, "choice") {
        Ok(v) => v,
        Err(e) => return print_err(&e),
    };

    let store = cli_source();
    match submit_ballot_impl(
        &store,
        SubmitArgs {
            voter_id,
            token,
            choice,
        },
    ) {
        Ok(r) => {
            println!(
                "{}",
                json!({
                    "tracking_code": r.tracking_code,
                    "submitted_at": r.submitted_at,
                })
            );
            ExitCode::SUCCESS
        }
        Err(e) => print_err(&e),
    }
}

fn parse_flags(rest: &[String]) -> Result<HashMap<String, String>, String> {
    let mut out = HashMap::new();
    let mut i = 0;
    while i < rest.len() {
        let key = &rest[i];
        if !key.starts_with("--") {
            return Err(format!("expected --flag, got {key}"));
        }
        let name = key.trim_start_matches("--").to_string();
        let value = rest
            .get(i + 1)
            .ok_or_else(|| format!("flag {key} missing value"))?
            .clone();
        out.insert(name, value);
        i += 2;
    }
    Ok(out)
}

fn required(flags: &HashMap<String, String>, name: &str) -> Result<String, String> {
    flags
        .get(name)
        .cloned()
        .ok_or_else(|| format!("missing required flag --{name}"))
}

fn required_u64(flags: &HashMap<String, String>, name: &str) -> Result<u64, String> {
    let raw = required(flags, name)?;
    raw.parse::<u64>()
        .map_err(|e| format!("--{name} must be a u64: {e}"))
}

fn print_err(msg: &str) -> ExitCode {
    // stdout (not stderr) so Dart can parse a single channel.
    println!("{}", json!({ "error": msg }));
    ExitCode::from(1)
}
