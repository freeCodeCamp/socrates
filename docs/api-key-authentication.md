# API Key Authentication

The Librarian API uses API key authentication to secure access to the hint generation endpoint.

## Generating an API Key

To generate a secure API key, run:

```bash
npm run generate-api-key
```

This will output:
```
Generated API Key:
a1b2c3d4e5f6...

Add this to your .env file:
API_KEY=a1b2c3d4e5f6...

Clients should send this key in the X-API-Key header
```

## Configuration

1. Copy the generated key to your `.env` file:
   ```bash
   API_KEY=your-generated-key-here
   ```

2. Restart the server for the changes to take effect

## Making Authenticated Requests

All requests to `/hint` must include the API key in the `X-API-Key` header:

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"description":"...","userInput":"...","tests":[...],"userId":"..."}'
```

## Error Responses

### Missing API Key (401)
```json
{
  "message": "API key is required. Include it in the X-API-Key header.",
  "status": 401
}
```

### Invalid API Key (403)
```json
{
  "message": "Invalid API key",
  "status": 403
}
```

## Development Mode

If `API_KEY` is not set in the environment (development mode), API key validation is **skipped** and all requests are allowed. This makes local development easier.

## Production Requirements

In production (`NODE_ENV=production`), the `API_KEY` environment variable is **required**. The server will not start without it.

## Security Best Practices

- **Never commit** your API key to version control
- Use different API keys for different environments (dev, staging, prod)
- Rotate API keys periodically
- Store API keys securely (use secrets management in production)
- Always use HTTPS in production to protect the API key in transit
