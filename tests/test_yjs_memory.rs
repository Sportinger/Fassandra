use yrs::{Doc, Transact, Update, WriteTxn};
use yrs::encoding::read::Cursor;
use yrs::sync::{Message, SyncMessage};
use yrs::updates::decoder::{Decode, DecoderV1};

fn main() {
    println!("Testing Yjs memory allocation issue...");
    
    // Create a document and transaction
    let doc = Doc::new();
    let mut txn = doc.transact_mut();
    
    // Test case 1: Small state vector
    println!("\nTest 1: Small state vector");
    let small_sv = vec![0u8; 10];
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        txn.encode_state_as_update_v1(&small_sv)
    })) {
        Ok(update_bytes) => println!("Success! Generated update size: {} bytes", update_bytes.len()),
        Err(_) => println!("Panic occurred!"),
    }
    
    // Test case 2: Malformed state vector that might cause issues
    println!("\nTest 2: Malformed state vector");
    let malformed_sv = vec![255u8; 100]; // All 0xFF bytes
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        txn.encode_state_as_update_v1(&malformed_sv)
    })) {
        Ok(update_bytes) => println!("Success! Generated update size: {} bytes", update_bytes.len()),
        Err(_) => println!("Panic occurred!"),
    }
    
    // Test case 3: Let's decode some actual sync messages
    println!("\nTest 3: Decoding sync messages");
    
    // Example of a SyncStep1 message that might be problematic
    let sync_step1_bytes = vec![0, 0, 1, 5, 255, 255, 255, 255]; // Example data
    
    match Message::decode(&mut DecoderV1::new(Cursor::new(&sync_step1_bytes))) {
        Ok(Message::Sync(SyncMessage::SyncStep1(sv))) => {
            println!("Decoded SyncStep1 with state vector length: {} bytes", sv.len());
            
            // Try to encode this state vector
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                txn.encode_state_as_update_v1(&sv)
            })) {
                Ok(update_bytes) => println!("Generated update size: {} bytes", update_bytes.len()),
                Err(_) => println!("Panic occurred when encoding state vector!"),
            }
        }
        Ok(msg) => println!("Decoded different message type: {:?}", msg),
        Err(e) => println!("Failed to decode: {:?}", e),
    }
    
    // Test case 4: Check what happens with specific byte patterns
    println!("\nTest 4: Specific byte patterns");
    for pattern in &[
        vec![0, 0, 0, 0],
        vec![1, 0, 0, 0],
        vec![255, 255, 255, 255],
        vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    ] {
        print!("Testing pattern {:?}: ", pattern);
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            txn.encode_state_as_update_v1(pattern)
        })) {
            Ok(update_bytes) => println!("Generated {} bytes", update_bytes.len()),
            Err(_) => println!("Panic!"),
        }
    }
}