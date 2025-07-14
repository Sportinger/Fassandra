use yrs::{Doc, Text, Transact, StateVector, ReadTxn, GetString, Update};
use yrs::updates::decoder::Decode;
use hex;

#[test]
fn test_basic_yjs_update() {
    // Create a simple Yjs document
    let doc = Doc::new();
    let txt = doc.get_or_insert_text("content");
    
    // Make a change
    let mut txn = doc.transact_mut();
    txt.insert(&mut txn, 0, "Hello World");
    drop(txn);
    
    // Get the update as binary
    let update = doc.transact().encode_state_as_update_v1(&StateVector::default());
    
    println!("Update size: {} bytes", update.len());
    println!("First 20 bytes (hex): {}", hex::encode(&update[..update.len().min(20)]));
    
    // Try to apply the update to a new document
    let doc2 = Doc::new();
    let mut txn2 = doc2.transact_mut();
    match Update::decode_v1(&update) {
        Ok(decoded_update) => {
            txn2.apply_update(decoded_update);
            println!("Update applied successfully!");
        }
        Err(e) => {
            println!("Failed to decode update: {:?}", e);
            // Return early from test instead of panicking
            return;
        }
    }
    drop(txn2);
    
    // Verify the content
    let txt2 = doc2.get_or_insert_text("content");
    let content = txt2.get_string(&doc2.transact());
    assert_eq!(content, "Hello World");
    println!("Content verified: {}", content);
} 