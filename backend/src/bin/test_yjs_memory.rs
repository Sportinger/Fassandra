use yrs::{Doc, Transact, ReadTxn, WriteTxn, Text};

fn main() {
    println!("Testing Yjs memory allocation issue...");
    
    // Create a document and transaction
    let doc = Doc::new();
    let txn = doc.transact();
    
    // Get the actual state vector from the document
    let sv = txn.state_vector();
    
    println!("Current state vector: {:?}", sv);
    
    // Test encoding with the real state vector
    print!("Testing encode_state_as_update_v1 with current state: ");
    
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
        }
    }
    
    // Create another doc with some content to test with non-empty state
    println!("\nTesting with document containing data:");
    let doc2 = Doc::new();
    {
        let mut txn2 = doc2.transact_mut();
        let text = txn2.get_or_insert_text("test");
        text.insert(&mut txn2, 0, "Hello world!");
    }
    
    let txn2 = doc2.transact();
    let sv2 = txn2.state_vector();
    
    print!("Testing with non-empty document state: ");
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        txn2.encode_state_as_update_v1(&sv2)
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