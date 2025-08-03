# Testing Claude Code Integration

## Prerequisites
1. Make sure all containers are running: `docker-compose ps`
2. Open a terminal to monitor Claude Code activity: `./monitor_claude.sh`

## Test Steps

1. **Open the application in your browser**
   - Go to http://localhost:8080
   - Log in with your credentials

2. **Navigate to Scripts page**
   - Click on "Scripts" in the navigation

3. **Upload a PDF**
   - Click the upload button
   - Select a theater script PDF file
   - Click "Upload"

4. **Monitor Progress**
   - You should see a progress bar showing Claude Code processing
   - The monitor script terminal will show real-time activity
   - Status updates: "Processing", "Parsing PDF", "Creating JSON", "Inserting Data"

5. **Completion**
   - When done, you'll see "Processing complete!" message
   - A new script should appear in your scripts list
   - Claude Code will output "iam done with my job rom" when finished

## What's Happening Behind the Scenes

1. PDF uploads to `/home/admins/projects/pessoa/backend/uploads/scripts/`
2. Backend starts Claude Code with:
   - The PDF file path
   - Instructions from `prompt.md`
   - Your username
3. Claude Code:
   - Parses the PDF
   - Creates a JSON representation
   - Runs `json_to_db.sh` to insert into database
4. WebSocket sends real-time updates to frontend
5. Frontend shows progress and completion

## Troubleshooting

- If upload fails: Check browser console for errors
- If Claude Code doesn't start: Check `docker logs dev_pessoa_backend`
- If WebSocket disconnects: Refresh the page and try again
- To cancel a running session: Click the cancel button in the progress dialog

## Current Status
✅ PDF upload endpoint working
✅ Claude Code installed and accessible (using --print flag)
✅ WebSocket authentication fixed
✅ Real-time progress updates
✅ Session management
✅ Cancellation support
✅ Fixed "No such file or directory" error - Claude Code now runs correctly

## Recent Fixes
- Changed command from `claude-code` to `/home/appuser/.npm-global/bin/claude`
- Updated to use `--print` flag instead of non-existent `--non-interactive`
- Added `--dangerously-skip-permissions` for Docker environment
- Fixed execution to run inside container instead of via docker exec