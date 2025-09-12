use crate::audio::types::{TokenMap, AsrPartial};

pub struct CorridorAligner {
    pub token_map: TokenMap,
    pub p: isize,
    pub backtrack: usize,
    pub lookahead: usize,
}

impl CorridorAligner {
    pub fn new(token_map: TokenMap, backtrack: usize, lookahead: usize) -> Self {
        Self { p: 0, token_map, backtrack, lookahead }
    }

    pub fn normalize_token(s: &str) -> String {
        s.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { ' ' })
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("")
    }

    // Very simple scoring: count in-order matches within corridor window
    pub fn score_window(asr_tokens: &[String], window: &[String]) -> usize {
        let mut score = 0;
        if asr_tokens.is_empty() || window.is_empty() { return 0; }
        let mut j = 0usize;
        for t in asr_tokens.iter() {
            while j < window.len() {
                if &window[j] == t { score += 1; j += 1; break; }
                j += 1;
            }
            if j >= window.len() { break; }
        }
        score
    }

    pub fn update_with_asr(&mut self, partial: &AsrPartial) -> Option<u32> {
        if self.token_map.tokens.is_empty() { return None; }

        // take last up to 15 words
        let mut asr_norm: Vec<String> = partial
            .words
            .iter()
            .map(|w| Self::normalize_token(&w.w))
            .filter(|s| !s.is_empty())
            .collect();
        if asr_norm.len() > 15 { asr_norm = asr_norm[asr_norm.len()-15..].to_vec(); }
        if asr_norm.is_empty() { return None; }

        let p = self.p.max(0) as usize;
        let start = p.saturating_sub(self.backtrack);
        let end = (p + self.lookahead).min(self.token_map.tokens.len());

        let mut best_idx = p;
        let mut best_score = 0usize;
        let mut i = start;
        while i < end {
            let win_end = (i + asr_norm.len().max(5)).min(end); // at least some width
            let window = &self.token_map.tokens[i..win_end];
            let score = Self::score_window(&asr_norm, window);
            if score > best_score {
                best_score = score;
                best_idx = i;
            }
            i += 3; // stride for speed
        }

        // simple threshold
        if best_score >= (asr_norm.len() / 2).max(2) {
            self.p = best_idx as isize;
            return Some(self.token_map.offsets[best_idx]);
        }

        None
    }
}

