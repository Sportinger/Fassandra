# Claude Code PDF Processing Integration Roadmap

## Overview
Integrate Claude Code into the PDF upload workflow to automatically parse theater scripts and populate the database using the existing `json_to_db.sh` script.

## Architecture Design

### 1. PDF Upload Flow
```
Frontend Upload → Backend API → Save to ./backend/uploads/scripts/ → Trigger Claude Code → Monitor Progress → Database Population → Cleanup
```

### 2. Path Mapping
- **Host Path**: `./backend/uploads/scripts/filename.pdf`
- **Container Path**: `/app/uploads/scripts/filename.pdf`
- **Prompt Path**: `/app/src/services/prompt.md`

### 3. Session Management

#### Session Lifecycle
1. **Start**: Spawn Claude Code process with PDF and username
2. **Monitor**: Track output and progress
3. **Complete**: Detect "iam done with my job rom" phrase
4. **Cleanup**: Remove PDF and temporary files

#### Progress Tracking Strategy
- Stream Claude Code output line by line
- Parse specific markers:
  - "Reading PDF file..." → Status: Reading (10%)
  - "Extracting text..." → Status: Extracting (20%)
  - "Parsing script structure..." → Status: Parsing (40%)
  - "Creating JSON..." → Status: Formatting (60%)
  - "Running json_to_db..." → Status: Inserting (80%)
  - "iam done with my job rom" → Status: Complete (100%)

## Implementation Plan

### Phase 1: Backend Infrastructure (Week 1)

#### 1.1 Create Claude Code Service
```rust
// backend/src/services/claude_code_service.rs
pub struct ClaudeCodeService {
    sessions: Arc<Mutex<HashMap<Uuid, SessionInfo>>>
}

pub struct SessionInfo {
    id: Uuid,
    status: SessionStatus,
    progress: u8,
    output: Vec<String>,
    started_at: DateTime<Utc>,
    pid: Option<u32>,
    username: String,
    pdf_filename: String,
}

pub enum SessionStatus {
    Starting,
    Reading,
    Extracting,
    Parsing,
    Formatting,
    Inserting,
    Complete,
    Failed(String),
    Timeout,
}
```

#### 1.2 Implement Core Methods
- `spawn_claude_session(pdf_path: &str, username: &str) -> Result<Uuid>`
- `monitor_session(session_id: Uuid) -> Result<SessionInfo>`
- `get_session_logs(session_id: Uuid, since_line: usize) -> Result<Vec<String>>`
- `terminate_session(session_id: Uuid) -> Result<()>`

### Phase 2: API Integration (Week 1)

#### 2.1 Modify Upload Handler
```rust
// Modify existing upload_and_parse_script
// Save PDF to uploads/scripts/ without deletion
// Trigger Claude Code session
// Return session_id for tracking
```

#### 2.2 New Endpoints
```
POST   /api/scripts/upload-pdf
       → Saves PDF, starts Claude session
       → Returns: { session_id, message }

GET    /api/scripts/session/{id}
       → Returns: { status, progress, logs[], created_at }

POST   /api/scripts/session/{id}/stop
       → Terminates session
       → Returns: { success, message }

WS     /api/scripts/session/{id}/stream
       → WebSocket for real-time progress updates
```

### Phase 3: Claude Code Execution (Week 2)

#### 3.1 Command Structure
```bash
docker exec -i pessoa_backend claude-code --non-interactive << 'EOF'
Parse the PDF at /app/uploads/scripts/{filename} using the instructions in /app/src/services/prompt.md
The username is: {username}
When complete, the json_to_db.sh script should have successfully inserted the data.
EOF
```

#### 3.2 Output Parsing
- Capture stdout/stderr
- Buffer lines for progress detection
- Search for completion phrase: "iam done with my job rom"
- Handle timeout (default: 10 minutes)

### Phase 4: Frontend Integration (Week 2)

#### 4.1 Update ScriptUploader
- Show "Processing with AI..." status
- Redirect to progress view after upload

#### 4.2 Create Progress Component
```typescript
interface ProcessingProgress {
    sessionId: string;
    status: SessionStatus;
    progress: number;
    logs: string[];
    onComplete: (scriptId: string) => void;
    onError: (error: string) => void;
}
```

#### 4.3 WebSocket Integration
- Connect to session stream endpoint
- Update progress bar in real-time
- Show recent log entries
- Handle completion/error states

### Phase 5: Error Handling & Recovery (Week 3)

#### 5.1 Failure Scenarios
- Claude Code crashes
- JSON parsing errors
- Database insertion failures
- Timeout exceeded
- Invalid PDF format

#### 5.2 Recovery Strategies
- Retry mechanism for transient failures
- Save Claude Code output for debugging
- Cleanup orphaned files
- User notification system

### Phase 6: Monitoring & Optimization (Week 3)

#### 6.1 Metrics
- Average processing time per page
- Success/failure rates
- Common error patterns
- Resource usage (CPU/Memory)

#### 6.2 Optimizations
- Concurrent session limit
- Queue system for high load
- PDF size limits
- Session cleanup cron job

## Technical Considerations

### Security
- Validate PDF files before processing
- Sanitize filenames
- Limit concurrent sessions per user
- Secure session IDs (UUID v4)

### Performance
- Stream large outputs efficiently
- Implement pagination for logs
- Clean up completed sessions after 24h
- Monitor Docker container resources

### User Experience
- Clear progress indicators
- Helpful error messages
- Allow session cancellation
- Show estimated time remaining

## Testing Strategy

### Unit Tests
- Session management logic
- Output parsing functions
- Progress calculation

### Integration Tests
- Full upload → process → complete flow
- Error scenarios
- Concurrent session handling

### E2E Tests
- Upload various PDF formats
- Monitor progress updates
- Verify database population

## Rollout Plan

1. **Alpha**: Internal testing with sample PDFs
2. **Beta**: Limited users with monitoring
3. **Production**: Full rollout with metrics

## Success Criteria

- 95% success rate for valid PDFs
- Average processing time < 2 min per 50 pages
- Real-time progress updates < 1s latency
- Zero orphaned files after 24h
- User satisfaction > 4.5/5

## Future Enhancements

1. **Batch Processing**: Upload multiple PDFs
2. **Template Support**: Custom parsing rules
3. **Preview Mode**: Show parsed structure before commit
4. **Revision History**: Track parsing attempts
5. **API Access**: Programmatic PDF submission

## Timeline

- **Week 1**: Backend infrastructure + API
- **Week 2**: Claude Code integration + Frontend
- **Week 3**: Testing + Error handling + Deployment

Total estimated time: 3 weeks

## Dependencies

- Claude Code installed in backend container ✓
- Working json_to_db.sh script ✓
- PDF upload functionality ✓
- Database schema ready ✓
- Anthropic API key configured ✓

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude Code hangs | High | Timeout + force kill |
| Large PDFs OOM | Medium | File size limits |
| Parsing errors | Medium | Retry + manual review |
| API rate limits | Low | Queue + backoff |

## Notes

- The completion phrase "iam done with my job rom" is already added to prompt.md
- Consider adding more granular progress markers to prompt.md
- Monitor Claude Code token usage for cost optimization