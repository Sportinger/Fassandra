use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct SessionMonitor {
    session_id: Uuid,
    log_file: PathBuf,
    file_handle: Option<File>,
}

impl SessionMonitor {
    pub fn new(session_id: Uuid) -> Self {
        let log_dir = PathBuf::from("/tmp/claude-sessions");
        std::fs::create_dir_all(&log_dir).ok();
        
        let log_file = log_dir.join(format!("session_{}.log", session_id));
        
        // Create a symlink to the latest session
        let latest_link = log_dir.join("latest.log");
        let _ = std::fs::remove_file(&latest_link);
        let _ = std::os::unix::fs::symlink(&log_file, &latest_link);
        
        Self {
            session_id,
            log_file,
            file_handle: None,
        }
    }
    
    pub fn start(&mut self) -> std::io::Result<()> {
        self.file_handle = Some(
            OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(&self.log_file)?
        );
        
        self.write_line(&format!("=== Claude Session Started: {} ===", Utc::now()))?;
        self.write_line(&format!("Session ID: {}", self.session_id))?;
        self.write_line(&format!("Log file: {}", self.log_file.display()))?;
        self.write_line("Monitor with: tail -f /tmp/claude-sessions/latest.log")?;
        self.write_line("=")?;
        
        Ok(())
    }
    
    pub fn write_line(&mut self, line: &str) -> std::io::Result<()> {
        if let Some(ref mut file) = self.file_handle {
            writeln!(file, "[{}] {}", Utc::now().format("%H:%M:%S"), line)?;
            file.flush()?;
        }
        Ok(())
    }
    
    pub fn close(&mut self) {
        if let Some(ref mut file) = self.file_handle {
            let _ = writeln!(file, "=== Session Ended: {} ===", Utc::now());
            let _ = file.flush();
        }
        self.file_handle = None;
    }
}

impl Drop for SessionMonitor {
    fn drop(&mut self) {
        self.close();
    }
}