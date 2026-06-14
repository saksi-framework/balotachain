use bulletin_store::{default_path, load};
use e2e_runner::{run_one_voter_cycle, summarize};
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let path: PathBuf = match args.next() {
        Some(p) => PathBuf::from(p),
        None => default_path(),
    };

    println!("Running BalotaChain one-voter cycle against {}", path.display());
    if path.exists() {
        std::fs::remove_file(&path).ok();
        println!("  cleared existing bulletin");
    }

    let outcome = run_one_voter_cycle(&path)?;
    println!();
    println!("Cycle complete.");
    println!("  tracking code: {}", outcome.tracking_code);
    println!("  tally fingerprint: {}", outcome.fingerprint);
    println!();
    let bulletin = load(&path)?;
    print!("{}", summarize(&bulletin));
    Ok(())
}
