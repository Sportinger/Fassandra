# Testing Claude Code PDF Parser

## Prerequisites

1. **Get your Anthropic API Key**
   - Go to https://console.anthropic.com/
   - Create an API key
   - Keep it secure!

2. **Set the API Key**
   ```bash
   # Option 1: Set temporarily for this session
   export ANTHROPIC_API_KEY='sk-ant-api03-YOUR-KEY-HERE'
   
   # Option 2: Add to backend/.env file (recommended)
   echo "ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE" >> backend/.env
   
   # If using .env, load it:
   source backend/.env
   export $(grep ANTHROPIC_API_KEY backend/.env | xargs)
   ```

## Testing Methods

### Method 1: Direct Rust Test (Outside Docker)

```bash
# From the backend directory
cd /home/admins/projects/pessoa/backend

# Make sure Claude Code CLI is installed locally
npm install -g @anthropic-ai/claude-code

# Run the test parser
cargo run --bin test_parser /home/admins/projects/pessoa/doc/test.pdf abc
```

### Method 2: Inside Docker Container

```bash
# First, make sure Docker is running
docker-compose up -d

# Enter the backend container
docker exec -it dev_pessoa_backend /bin/bash

# Inside the container, set your API key
export ANTHROPIC_API_KEY='sk-ant-api03-YOUR-KEY-HERE'

# Test Claude Code CLI directly
claude --version

# Run the test parser inside container
cd /app
./target/debug/test_parser /home/admins/projects/pessoa/doc/test.pdf abc
```

### Method 3: Test Script (if Claude Code is installed locally)

```bash
# From backend directory
./test_claude_parsing.sh /home/admins/projects/pessoa/doc/test.pdf abc
```

### Method 4: Via API (requires backend running)

```bash
# First, start the backend
cargo run

# In another terminal, login to get a token
TOKEN=$(curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abc","password":"your-password"}' \
  | jq -r '.token')

# Then call the parse endpoint
curl -X POST "http://localhost:3000/api/s/parse-pdf/$(realpath /home/admins/projects/pessoa/doc/test.pdf)" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected Behavior

When Claude Code successfully runs:

1. It will invoke the `pdf-script-parser` agent
2. The agent will:
   - Read the PDF file
   - Extract text using pdftotext
   - Parse the script structure
   - Insert data into PostgreSQL database
3. You'll get a session ID back
4. Check the database for the parsed data:
   ```sql
   -- Connect to database
   psql postgres://pessoa_user:dev_password_123@localhost:5432/pessoa_db
   
   -- Check for scripts
   SELECT * FROM scripts WHERE created_by = (SELECT id FROM users WHERE username = 'abc');
   
   -- Check for blocks
   SELECT * FROM blocks WHERE script_id = 'YOUR-SCRIPT-ID';
   ```

## Troubleshooting

1. **"claude: command not found"**
   - Install Claude Code: `npm install -g @anthropic-ai/claude-code`
   - Or test inside Docker container where it's pre-installed

2. **"ANTHROPIC_API_KEY not set"**
   - Make sure you've exported the environment variable
   - Check with: `echo $ANTHROPIC_API_KEY`

3. **"User not found" error**
   - The username must exist in the database
   - Check users: `SELECT username, email FROM users;`

4. **Permission errors**
   - Make sure the PDF file is readable
   - Ensure database credentials are correct

## The Agent Prompt

The system uses this prompt structure:

```
Please use the pdf-script-parser agent to parse the following PDF script and insert it into the database:

PDF Path: /path/to/script.pdf
Username: user@example.com

The agent should:
1. Extract the script content from the PDF
2. Parse it to identify dialogue, stage directions, and other theatrical elements  
3. Insert the parsed data into the PostgreSQL database with the specified username as the owner

Please execute this task now using the pdf-script-parser agent.
```

This matches the expected format in `.claude/agents/pdf-script-parser.md`. 