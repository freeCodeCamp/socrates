#!/bin/bash

# Pull and run Qwen 2.5 7B model
echo "Pulling Qwen 2.5 7B model..."
docker exec ollama ollama pull qwen2.5:7b

echo "Testing model..."
docker exec ollama ollama run qwen2.5:7b "Hello, can you give me a short coding hint?"

echo "Setup complete! Ollama is running with Qwen 2.5 7B"
echo "API available at: http://localhost:11434"