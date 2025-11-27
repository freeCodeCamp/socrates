#!/bin/bash

# Pull and run Llama 3.2 3B model
echo "Pulling Llama 3.2 3B model..."
docker exec ollama ollama pull llama3.2:3b

echo "Testing model..."
docker exec ollama ollama run llama3.2:3b "Hello, can you give me a short coding hint?"

echo "Setup complete! Ollama is running with Llama 3.2 3B"
echo "API available at: http://localhost:11434"