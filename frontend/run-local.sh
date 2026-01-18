#!/bin/bash
# Run the frontend locally without Docker

export VITE_BACKEND_URL=http://localhost:3000
export VITE_ENVIRONMENT=development

npm run dev
