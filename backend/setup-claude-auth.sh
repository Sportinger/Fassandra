#!/bin/bash

echo "Setting up Claude browser authentication in Docker container..."
echo ""
echo "You need to authenticate Claude for the appuser in the container."
echo "This will open a browser authentication flow."
echo ""
echo "Steps:"
echo "1. Run this command to login as appuser:"
echo "   docker exec -it -u appuser dev_pessoa_backend /bin/bash"
echo ""
echo "2. Once inside the container, run:"
echo "   claude login"
echo ""
echo "3. Follow the browser authentication flow"
echo ""
echo "4. After authentication, test with:"
echo "   echo 'What is 2+2?' | claude --print --dangerously-skip-permissions"
echo ""
echo "5. Exit the container:"
echo "   exit"
echo ""
echo "Press Enter to open the container shell as appuser..."
read

docker exec -it -u appuser dev_pessoa_backend /bin/bash