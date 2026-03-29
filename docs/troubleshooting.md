# Troubleshooting Guide

## Common Startup Issues

### Database Connection Failed

**Symptom:** The service exits with a PostgreSQL connection error on startup.

**Causes:**

- PostgreSQL is not running
- `DATABASE_URL` is missing or incorrect in the `.env` file
- The database or user does not exist

**Resolution:**

1. Ensure PostgreSQL is running: `docker compose up -d`
2. Verify the connection string in `.env` matches your PostgreSQL setup
3. Default connection string: `postgres://stackcraft:stackcraft@localhost:5433/stackcraft`

### Port Already in Use

**Symptom:** `EADDRINUSE` error on startup.

**Causes:**

- Another instance of the service or another application is using port 9090 (or 8080 for frontend)

**Resolution:**

1. Stop the other process using the port
2. Or set a different port via the `APP_SERVICE_PORT` environment variable in `.env`

### Missing Environment File

**Symptom:** Service starts but cannot connect to the database.

**Resolution:**

1. Copy the example file: `cp .env.example .env`
2. Adjust values if your PostgreSQL setup differs from defaults

---

## Service Management Issues

### Service Stuck in "Starting" or "Installing" State

**Symptom:** A managed service shows a stale status that never resolves.

**Cause:** The backend was restarted while a service operation was in progress. The state was persisted but the process no longer exists.

**Resolution:** On startup, Stack Craft automatically reconciles stale states. Restart the Stack Craft backend and the stuck service should return to a normal state.

### Clone/Pull Fails

**Symptom:** Cloning or pulling a repository fails with a git error.

**Common causes:**

- The repository URL is invalid or inaccessible
- Git is not installed on the system
- Authentication is required but not configured
- The target directory has conflicting content

**Resolution:**

1. Verify the repository URL in the repository settings
2. Ensure `git` is available in the system `PATH`
3. For private repositories, ensure SSH keys or credentials are configured
4. Check the service logs for the specific git error message

### Prerequisite Check Fails

**Symptom:** A prerequisite shows as "not satisfied" even though the tool is installed.

**Common causes:**

- The command runs in a restricted environment without access to the full `PATH`
- The expected version pattern does not match the installed version

**Resolution:**

1. Check the prerequisite configuration (command, expected output pattern)
2. Verify the tool is accessible from a clean shell (not just your user profile)
3. Review the check output in the prerequisite details for the actual command output

---

## Viewing Logs

### Service Logs (Managed Services)

Service stdout/stderr is captured in-memory and available via:

- **UI:** Navigate to the service detail page and click the "Logs" tab
- **API:** `GET /api/services/:id/logs?lines=300&search=error`
- **MCP:** Use the `get_service_logs` tool

**Note:** Service logs are stored in-memory with a limit of 50,000 entries per service. Logs are lost when the Stack Craft backend restarts.

### Application Logs (Stack Craft Backend)

The backend logs to stdout via the FuryStack `VerboseConsoleLogger`. Log verbosity can be configured via the `LOG_LEVEL` environment variable (default: `verbose`). Available levels: `verbose`, `debug`, `information`, `warning`, `error`, `fatal`. In production, pipe stdout to your preferred log aggregator:

```bash
# Docker
docker logs <container-id>

# systemd
journalctl -u stack-craft

# File redirect
yarn start:service >> /var/log/stack-craft.log 2>&1
```

### Health Check

Use the health endpoint to verify the service is running and the database is connected:

```bash
curl http://localhost:9090/api/system/health
# {"status":"ok","uptime":12345,"version":"1.0.3","database":"connected"}
```

---

## Environment Variables Reference

| Variable                     | Default                                                      | Description                                                                                                      |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | `postgres://stackcraft:stackcraft@localhost:5433/stackcraft` | PostgreSQL connection string                                                                                     |
| `APP_SERVICE_PORT`           | `9090`                                                       | Backend HTTP server port                                                                                         |
| `MCP_PORT`                   | `9091`                                                       | MCP server port                                                                                                  |
| `STACK_CRAFT_ENCRYPTION_KEY` | _(auto-generated)_                                           | Base64-encoded 256-bit key for encrypting sensitive values. If unset, a key file is created in `~/.stack-craft/` |

---

## MCP Server Troubleshooting

### Connection Refused on Port 9091

**Symptom:** `curl: (7) Failed to connect to localhost port 9091: Connection refused`

**Causes:**

- The Stack Craft service is not running
- The MCP server is configured on a different port

**Resolution:**

1. Verify the service is running: `curl http://localhost:9090/api/system/health`
2. Check the `MCP_PORT` value in your `.env` file (default: `9091`)
3. Ensure nothing else is occupying the configured port

### Authentication Errors

**Symptom:** MCP tool calls return `401 Unauthorized` or `403 Forbidden`.

**Cause:** The MCP server requires a Bearer token for authentication.

**Resolution:**

1. Open the Stack Craft UI and navigate to **User Settings**
2. Create a new API token
3. Configure your MCP client with the token as a Bearer token in the `Authorization` header

### Common Tool Errors

**Symptom:** MCP tool calls return "Service not found" or "Stack not found".

**Causes:**

- The service or stack ID/name is incorrect
- The resource was deleted or has not been imported yet

**Resolution:**

1. Use the `list_services` or `list_stacks` MCP tool to verify available resources
2. Double-check the ID or name passed to the tool
3. Import the stack or create the service if it does not exist yet

### Testing the MCP Endpoint

You can verify the MCP server is listening with:

```bash
curl http://localhost:9091/mcp
# Expects 405 Method Not Allowed — the endpoint requires POST with SSE
```

A `405` response confirms the MCP server is running and reachable. Any other response (connection refused, timeout) indicates the server is not available.

---

## Encryption Key Issues

### Encryption Key Changed or Lost

**Symptom:** Services that previously stored encrypted values (e.g. environment variable secrets) show decryption errors or garbled values.

**Cause:** The `STACK_CRAFT_ENCRYPTION_KEY` has changed since the values were encrypted. Existing encrypted values become undecryptable with a different key.

**Resolution:**

1. If you still have the old key, restore it in `.env` and restart the service
2. If the old key is lost, you must re-enter all sensitive values (environment secrets, tokens, etc.) through the UI or API

### Rotating the Encryption Key

To rotate the encryption key:

1. Stop the Stack Craft service
2. Update `STACK_CRAFT_ENCRYPTION_KEY` in your `.env` file with a new base64-encoded 256-bit key
3. Start the service
4. Re-enter all sensitive values (environment secrets, tokens) — they must be re-encrypted with the new key

### Key File Location

If the `STACK_CRAFT_ENCRYPTION_KEY` environment variable is not set, Stack Craft auto-generates a key file at:

```
~/.stack-craft/encryption.key
```

This file is created on first startup and reused on subsequent runs. Back up this file to avoid losing access to encrypted values.

### Docker Persistence

**Symptom:** Encrypted values break after a container restart.

**Cause:** The auto-generated key file inside the container is lost when the container is recreated.

**Resolution:**

- **Option A:** Set the `STACK_CRAFT_ENCRYPTION_KEY` environment variable explicitly
- **Option B:** Mount the `~/.stack-craft/` directory as a volume to persist the key file

---

## Docker Production

### Port Mapping

Stack Craft exposes two ports that both need to be mapped:

| Port   | Protocol       | Purpose               |
| ------ | -------------- | --------------------- |
| `9090` | HTTP/WebSocket | REST API and frontend |
| `9091` | HTTP/SSE       | MCP server            |

### Encryption Key

In production, always set `STACK_CRAFT_ENCRYPTION_KEY` explicitly rather than relying on the auto-generated key file. Alternatively, mount `~/.stack-craft/` as a persistent volume.

### Example Docker Run

```bash
docker run -d \
  --name stack-craft \
  -p 9090:9090 \
  -p 9091:9091 \
  -e DATABASE_URL=postgres://stackcraft:stackcraft@db:5432/stackcraft \
  -e STACK_CRAFT_ENCRYPTION_KEY=your-base64-encoded-key \
  stack-craft:latest
```

---

## Getting Help

- Check the service logs for detailed error messages
- Use the MCP server (`localhost:9091`) with an AI assistant for interactive troubleshooting
- File issues at https://github.com/furystack/stack-craft/issues
