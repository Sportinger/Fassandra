use yrs::encoding::read::Cursor as IoCursor;
use yrs::sync::{Message as SyncEnvelope, SyncMessage};
use yrs::updates::decoder::Decode as _;

/// Outgoing frame to be written on the websocket
pub enum OutgoingFrame {
    Binary(Vec<u8>),
}

/// Minimal decode helper: check if a binary message is a Yrs Sync message and return it
pub fn decode_sync_message(bytes: &[u8]) -> Option<SyncEnvelope> {
    yrs::sync::Message::decode(&mut yrs::updates::decoder::DecoderV1::new(IoCursor::new(
        bytes,
    )))
    .ok()
}

/// Extract raw update payload if the message is an Update/SyncStep2
pub fn extract_update_bytes(bytes: &[u8]) -> Option<Vec<u8>> {
    if let Some(SyncEnvelope::Sync(inner)) = decode_sync_message(bytes) {
        match inner {
            SyncMessage::Update(update) => Some(update),
            SyncMessage::SyncStep2(update) => Some(update),
            _ => None,
        }
    } else {
        None
    }
}
