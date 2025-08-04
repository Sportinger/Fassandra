use yrs::{Doc, Transact, ReadTxn};

fn main() {
    println!("Testing Yjs memory allocation issue...");
    
    // Create a document and transaction
    let doc = Doc::new();
    let mut txn = doc.transact_mut();
    
    // Test different state vector sizes
    for size_power in 0..20 {
        let size = 1usize << size_power; // 1, 2, 4, 8, 16, 32, ...
        let sv = vec![0u8; size];
        
        print!("Testing state vector size {} bytes: ", size);
        
        // Measure memory before
        let before = get_memory_usage();
        
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            txn.encode_state_as_update_v1(&sv)
        })) {
            Ok(update_bytes) => {
                let after = get_memory_usage();
                println!("Success! Generated {} bytes, memory delta: {} MB", 
                    update_bytes.len(), 
                    (after as f64 - before as f64) / 1_000_000.0
                );
            }
            Err(_) => {
                println!("PANIC or allocation failure!");
                break;
            }
        }
    }
    
    // Test with malformed state vectors
    println!("\nTesting malformed state vectors:");
    
    // Pattern that might cause issues: large client ID
    let mut bad_sv = vec![0u8; 100];
    bad_sv[0] = 255;
    bad_sv[1] = 255;
    bad_sv[2] = 255;
    bad_sv[3] = 255;
    
    print!("Testing malformed state vector: ");
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        txn.encode_state_as_update_v1(&bad_sv)
    })) {
        Ok(update_bytes) => println!("Generated {} bytes", update_bytes.len()),
        Err(_) => println!("PANIC or allocation failure!"),
    }
}

#[cfg(target_os = "linux")]
fn get_memory_usage() -> usize {
    use std::fs;
    let status = fs::read_to_string("/proc/self/status").unwrap_or_default();
    for line in status.lines() {
        if line.starts_with("VmRSS:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                return parts[1].parse::<usize>().unwrap_or(0) * 1024; // Convert KB to bytes
            }
        }
    }
    0
}

#[cfg(not(target_os = "linux"))]
fn get_memory_usage() -> usize {
    0 // Dummy implementation for non-Linux
}