# Ollama Setup Instructions

## Local Development Setup

1. **Start the services:**

```bash
docker-compose up -d
```

2. **Install the model:**

```bash
./scripts/setup-ollama.sh
```

3. **Verify Ollama is running:**

```bash
curl http://localhost:11434/api/tags
```

4. **Test model inference:**

```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:7b",
    "prompt": "What is a simple hint for learning HTML?",
    "stream": false
  }'
```

## Production Deployment (DigitalOcean)

1. **Copy files to droplet:**

```bash
scp docker-compose.yml root@164.90.154.83:~/
scp -r scripts/ root@164.90.154.83:~/
```

2. **On the droplet:**

```bash
docker-compose up -d
./scripts/setup-ollama.sh
```

## Services

- **Ollama API**: http://164.90.154.83:11434
- **Redis**: redis://164.90.154.83:6379

## Model Info

- **Model**: qwen2.5:7b
- **Size**: ~2GB
- **RAM Usage**: ~2-4GB
