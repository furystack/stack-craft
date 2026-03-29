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

The backend logs to stdout via the FuryStack `VerboseConsoleLogger`. In production, pipe stdout to your preferred log aggregator:

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

| Variable                     | Default                                                      | Description                                                                                           |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | `postgres://stackcraft:stackcraft@localhost:5433/stackcraft` | PostgreSQL connection string                                                                          |
| `APP_SERVICE_PORT`           | `9090`                                                       | Backend HTTP server port                                                                              |
| `MCP_PORT`                   | `9091`                                                       | MCP server port                                                                                       |
| `STACK_CRAFT_ENCRYPTION_KEY` | *(auto-generated)*                                           | Base64-encoded 256-bit key for encrypting sensitive values. If unset, a key file is created in `~/.stack-craft/` |

---

## Getting Help

- Check the service logs for detailed error messages
- Use the MCP server (`localhost:9091`) with an AI assistant for interactive troubleshooting
- File issues at https://github.com/furystack/stack-craft/issues
