use crate::audio::types::{AsrPartial, TokenMap};
use std::collections::HashMap;
use tracing;

pub struct CorridorAligner {
    pub token_map: TokenMap,
    pub p: isize,
    pub backtrack: usize,
    pub lookahead: usize,
    pub stable_frames_required: usize,
    last_best_idx: Option<usize>,
    stable_counter: usize,
    idf_map: HashMap<String, f32>,
    last_word_indices: Option<Vec<usize>>,
    // Adaptive resync when we don't find good matches for a while
    no_match_counter: usize,
    resync_after_frames: usize,
    inv_index: HashMap<String, Vec<usize>>, // token -> positions
}

impl CorridorAligner {
    pub fn new(
        token_map: TokenMap,
        backtrack: usize,
        lookahead: usize,
        stable_frames_required: usize,
    ) -> Self {
        let idf_map = Self::compute_idf(&token_map.tokens);
        let idf_map = Self::compute_idf(&token_map.tokens);
        let inv_index = Self::build_inverted_index(&token_map.tokens);
        Self {
            p: 0,
            token_map,
            backtrack,
            lookahead,
            stable_frames_required,
            last_best_idx: None,
            stable_counter: 0,
            idf_map,
            last_word_indices: None,
            no_match_counter: 0,
            resync_after_frames: 8, // ~1-1.5s
            inv_index,
        }
    }

    fn compute_idf(tokens: &[String]) -> HashMap<String, f32> {
        let mut df: HashMap<&str, usize> = HashMap::new();
        for t in tokens {
            *df.entry(t.as_str()).or_insert(0) += 1;
        }
        let n = tokens.len().max(1) as f32;
        let mut out = HashMap::new();
        for (tok, cnt) in df {
            // classic idf
            let idf = (n / (cnt as f32 + 1.0)).ln().max(0.0) + 1.0; // >=1
            out.insert(tok.to_string(), idf);
        }
        out
    }

    fn build_inverted_index(tokens: &[String]) -> HashMap<String, Vec<usize>> {
        let mut map: HashMap<String, Vec<usize>> = HashMap::new();
        for (i, t) in tokens.iter().enumerate() {
            map.entry(t.clone()).or_default().push(i);
        }
        map
    }

    pub fn normalize_token(s: &str) -> String {
        // Lowercase + basic german normalizations
        let lower = s.to_lowercase();
        let mut buf = String::with_capacity(lower.len());
        for ch in lower.chars() {
            let mapped = match ch {
                'ä' => "ae",
                'ö' => "oe",
                'ü' => "ue",
                'ß' => "ss",
                _ => {
                    if ch.is_alphanumeric() {
                        ""
                    } else {
                        " "
                    }
                }
            };
            if !mapped.is_empty() {
                buf.push_str(mapped);
            } else if ch.is_alphanumeric() {
                buf.push(ch);
            } else {
                buf.push(' ');
            }
        }
        buf.split_whitespace().collect::<Vec<_>>().join("")
    }

    fn levenshtein_ratio(a: &str, b: &str) -> f32 {
        if a == b {
            return 1.0;
        }
        let ac: Vec<char> = a.chars().collect();
        let bc: Vec<char> = b.chars().collect();
        let al = ac.len();
        let bl = bc.len();
        if al == 0 || bl == 0 {
            return 0.0;
        }
        let mut dp = vec![0usize; (al + 1) * (bl + 1)];
        let idx = |i: usize, j: usize| -> usize { i * (bl + 1) + j };
        for i in 0..=al {
            dp[idx(i, 0)] = i;
        }
        for j in 0..=bl {
            dp[idx(0, j)] = j;
        }
        for i in 1..=al {
            for j in 1..=bl {
                let cost = if ac[i - 1] == bc[j - 1] { 0 } else { 1 };
                let del = dp[idx(i - 1, j)] + 1;
                let ins = dp[idx(i, j - 1)] + 1;
                let sub = dp[idx(i - 1, j - 1)] + cost;
                dp[idx(i, j)] = del.min(ins).min(sub);
            }
        }
        let dist = dp[idx(al, bl)] as f32;
        1.0 - (dist / (al.max(bl) as f32))
    }

    fn token_weight(&self, token: &str) -> f32 {
        // Anchor boosting via IDF (normalized roughly to ~1..3)
        *self.idf_map.get(token).unwrap_or(&1.0)
    }

    fn score_window_weighted(
        &self,
        asr_tokens: &[(String, f32)],
        window: &[String],
    ) -> (f32, usize, usize, usize, Vec<usize>) {
        if asr_tokens.is_empty() || window.is_empty() {
            return (0.0, 0, 0, 0, Vec::new());
        }
        let mut score = 0.0f32;
        let mut matches = 0usize;
        let mut j = 0usize;
        let max_jump = 6usize; // allow skipping in script
        let sim_min = 0.6f32;
        let mut first_match_idx: Option<usize> = None;
        let mut last_match_idx: Option<usize> = None;
        let mut path: Vec<usize> = Vec::new();
        for (t, conf) in asr_tokens.iter() {
            // scan ahead up to max_jump to find best match
            let mut best_local_sim = 0.0f32;
            let mut best_local_idx: Option<usize> = None;
            let end = (j + max_jump).min(window.len());
            for k in j..end {
                let sim = Self::levenshtein_ratio(t, &window[k]);
                if sim > best_local_sim {
                    best_local_sim = sim;
                    best_local_idx = Some(k);
                }
            }
            if let Some(k) = best_local_idx {
                if best_local_sim >= sim_min {
                    let idf = self.token_weight(&window[k]);
                    let conf_w = conf.max(0.5);
                    // Penalize jump distance slightly
                    let jump_pen = ((k as isize - j as isize).max(0) as f32) * 0.03;
                    score += (best_local_sim * idf * conf_w) - jump_pen;
                    matches += 1;
                    if first_match_idx.is_none() {
                        first_match_idx = Some(k);
                    }
                    last_match_idx = Some(k);
                    path.push(k);
                    j = k + 1;
                    continue;
                }
            }
            // no acceptable match: small penalty
            score -= 0.05;
        }
        let first = first_match_idx.unwrap_or(0);
        let last = last_match_idx.unwrap_or(first);
        (score, matches, first, last, path)
    }

    pub fn update_with_asr(&mut self, partial: &AsrPartial) -> Option<u32> {
        if self.token_map.tokens.is_empty() {
            return None;
        }

        // Last up to 15 words with confidence
        let mut asr_seq: Vec<(String, f32)> = partial
            .words
            .iter()
            .map(|w| (Self::normalize_token(&w.w), w.conf.unwrap_or(1.0)))
            .filter(|(s, _)| !s.is_empty())
            .collect();
        if asr_seq.len() > 15 {
            asr_seq = asr_seq[asr_seq.len() - 15..].to_vec();
        }
        if asr_seq.is_empty() {
            return None;
        }

        let p = self.p.max(0) as usize;
        let start = p.saturating_sub(self.backtrack);
        let end_bound = (p + self.lookahead).min(self.token_map.tokens.len());

        let mut best_idx = p;
        let mut best_score = f32::MIN;
        let mut best_matches = 0usize;
        let mut i = start;
        while i < end_bound {
            let win_end = (i + asr_seq.len().max(5)).min(end_bound); // some width
            let window = &self.token_map.tokens[i..win_end];
            let (score, matches, _first_rel, last_rel, rel_path) =
                self.score_window_weighted(&asr_seq, window);
            // Normalize score slightly by matches
            let norm = if matches > 0 {
                score / (matches as f32)
            } else {
                score - 1.0
            };
            // prefer more matches, then higher normalized score
            let better = matches > best_matches || (matches == best_matches && norm > best_score);
            if better {
                best_score = norm;
                best_matches = matches;
                // prefer the last matched token in the window for docPos highlighting
                best_idx = i + last_rel;
                // store absolute path indices for later word-trail mapping
                let abs_path: Vec<usize> = rel_path.into_iter().map(|k| i + k).collect();
                self.last_word_indices = Some(abs_path);
            }
            i += 2; // stride for speed
        }

        // decision threshold: at least len/3 matches (min 2) and reasonable normalized score
        let min_matches = (asr_seq.len() / 3).max(2);
        let accept = best_matches >= min_matches && best_score >= 0.45;

        if !accept {
            self.no_match_counter = self.no_match_counter.saturating_add(1);
            self.last_best_idx = None;
            self.stable_counter = 0;

            // If we've been stuck for a while, do a global resync (allow large jumps)
            if self.no_match_counter >= self.resync_after_frames {
                let mut g_best_idx = self.p.max(0) as usize;
                let mut g_best_score = f32::MIN;
                let mut g_best_matches = 0usize;
                let mut i = 0usize;
                let n = self.token_map.tokens.len();
                while i < n {
                    let end = (i + asr_seq.len().max(5)).min(n);
                    let window = &self.token_map.tokens[i..end];
                    let (g_score, g_matches, _f, g_last, _p) =
                        self.score_window_weighted(&asr_seq, window);
                    let g_norm = if g_matches > 0 {
                        g_score / (g_matches as f32)
                    } else {
                        g_score - 1.0
                    };
                    let better = g_matches > g_best_matches
                        || (g_matches == g_best_matches && g_norm > g_best_score);
                    if better {
                        g_best_matches = g_matches;
                        g_best_score = g_norm;
                        g_best_idx = i + g_last;
                    }
                    i += 5; // coarse stride for full scan
                }
                let g_min_matches = (asr_seq.len() / 4).max(2);
                if g_best_matches >= g_min_matches && g_best_score >= 0.42 {
                    // hard jump to new location, immediate update
                    tracing::info!(
                        "[align] global resync jump -> idx={}, matches={}, score={}",
                        g_best_idx,
                        g_best_matches,
                        g_best_score
                    );
                    self.p = g_best_idx as isize;
                    self.last_best_idx = Some(g_best_idx);
                    self.stable_counter = 0;
                    self.no_match_counter = 0;
                    return Some(*self.token_map.offsets.get(g_best_idx).unwrap_or(
                        &self.token_map.offsets[self.token_map.offsets.len().saturating_sub(1)],
                    ));
                }
            }

            // Try immediate anchor-based jump using rare high-confidence tokens
            if let Some((a_idx, a_matches, a_score)) = self.anchor_resync(&asr_seq) {
                tracing::info!(
                    "[align] anchor resync jump -> idx={}, matches={}, score={}",
                    a_idx,
                    a_matches,
                    a_score
                );
                self.p = a_idx as isize;
                self.last_best_idx = Some(a_idx);
                self.stable_counter = 0;
                self.no_match_counter = 0;
                return Some(*self.token_map.offsets.get(a_idx).unwrap_or(
                    &self.token_map.offsets[self.token_map.offsets.len().saturating_sub(1)],
                ));
            }
            return None;
        }

        // stability: require same area for a couple frames
        if self
            .last_best_idx
            .map(|x| (x as isize - best_idx as isize).abs() <= 6)
            .unwrap_or(false)
        {
            self.stable_counter += 1;
        } else {
            self.last_best_idx = Some(best_idx);
            self.stable_counter = 1;
        }

        if self.stable_counter >= self.stable_frames_required {
            self.p = best_idx as isize;
            self.last_best_idx = Some(best_idx);
            self.stable_counter = 0;
            self.no_match_counter = 0;
            return Some(self.token_map.offsets[best_idx]);
        }
        None
    }

    pub fn take_last_word_doc_positions(&mut self) -> Vec<u32> {
        if let Some(idxs) = self.last_word_indices.take() {
            idxs.into_iter()
                .filter_map(|i| self.token_map.offsets.get(i).cloned())
                .collect()
        } else {
            Vec::new()
        }
    }

    fn anchor_resync(&self, asr_seq: &[(String, f32)]) -> Option<(usize, usize, f32)> {
        // pick up to 3 best anchors by idf*conf
        let mut anchors: Vec<(String, f32)> = asr_seq
            .iter()
            .map(|(t, c)| (t.clone(), self.token_weight(t) * (*c)))
            .collect();
        anchors.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let anchors: Vec<String> = anchors.into_iter().take(3).map(|(t, _)| t).collect();

        let n = self.token_map.tokens.len();
        let mut best_idx = None;
        let mut best_matches = 0usize;
        let mut best_score = f32::MIN;

        for a in anchors {
            if let Some(positions) = self.inv_index.get(&a) {
                for &pos in positions.iter().take(200) {
                    // cap
                    let start = pos;
                    let end = (start + asr_seq.len().max(5)).min(n);
                    if start >= end {
                        continue;
                    }
                    let window = &self.token_map.tokens[start..end];
                    let (score, matches, _f, last_rel, _p) =
                        self.score_window_weighted(asr_seq, window);
                    let norm = if matches > 0 {
                        score / (matches as f32)
                    } else {
                        score - 1.0
                    };
                    let better =
                        matches > best_matches || (matches == best_matches && norm > best_score);
                    if better {
                        best_matches = matches;
                        best_score = norm;
                        best_idx = Some(start + last_rel);
                    }
                }
            }
        }
        if let Some(idx) = best_idx {
            let min_matches = (asr_seq.len() / 4).max(2);
            if best_matches >= min_matches && best_score >= 0.45 {
                return Some((idx, best_matches, best_score));
            }
        }
        None
    }
}
