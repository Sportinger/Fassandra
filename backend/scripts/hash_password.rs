use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHasher};
use rand::rngs::OsRng;
use std::env;

/// Utility for generating Argon2 password hashes
/// Used for creating password hashes for environment variables (e.g., ADMIN_PLACEHOLDER_HASH)
/// Usage: cargo run --bin hash_password <password>
fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: cargo run --bin hash_password <password_to_hash>");
        std::process::exit(1);
    }

    let password_to_hash = &args[1];

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    match argon2.hash_password(password_to_hash.as_bytes(), &salt) {
        Ok(hash) => {
            println!("{}", hash.to_string());
        }
        Err(e) => {
            eprintln!("Error hashing password: {}", e);
            std::process::exit(1);
        }
    }
}
