# MAGoCo Terminal v3.0

Professional HTTP-based web terminal with full shell access.

## Features

- **Full Shell Access** — Run any command (`apt`, `pip`, `npm`, `git`, etc.)
- **Session Management** — `cd` persists between commands
- **File Operations** — Upload/download files
- **System Monitoring** — CPU, RAM, Disk info
- **Package Installer** — Install packages via apt/npm/pip
- **Rate Limiting** — Protection against abuse
- **Command History** — Arrow keys for previous commands

## Quick Start

### Docker

```bash
docker build -t magoco-terminal .

docker run -d \
  -p 3000:3000 \
  -e TERMINAL_USER=admin \
  -e TERMINAL_PASS=your-secret-password \
  magoco-terminal
```

### Environment Variables (Secrets)

**⚠️ NEVER put passwords in code or Dockerfile.**

Set these in your deployment platform (Docker, Render, Railway, etc.):

| Variable | Required | Description |
|----------|----------|-------------|
| `TERMINAL_USER` | ✅ | Username for authentication |
| `TERMINAL_PASS` | ✅ | Password for authentication |
| `PORT` | ❌ | Server port (default: 3000) |
| `WORK_DIR` | ❌ | Working directory (default: /tmp) |
| `LOG_DIR` | ❌ | Log directory (default: /var/log/magoco-terminal) |

### Platform Examples

**Docker Compose:**
```yaml
services:
  terminal:
    build: .
    ports:
      - "3000:3000"
    environment:
      - TERMINAL_USER=${TERMINAL_USER}
      - TERMINAL_PASS=${TERMINAL_PASS}
    secrets:
      - terminal_pass

secrets:
  terminal_pass:
    file: ./secrets/password.txt
```

**Render:**
- Go to Environment tab
- Add `TERMINAL_USER` and `TERMINAL_PASS` as Environment Variables
- Mark as "Secret" for password

**Railway:**
- Go to Variables tab
- Add `TERMINAL_USER` and `TERMINAL_PASS`
- Toggle "Encrypt" for sensitive values

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | ❌ | Health check |
| `/ping` | GET | ❌ | Keepalive ping |
| `/` | GET | ❌ | Web UI |
| `/execute` | POST | ✅ | Execute command |
| `/batch` | POST | ✅ | Execute multiple commands |
| `/sysinfo` | GET | ✅ | System information |
| `/files` | POST | ✅ | List files |
| `/install` | POST | ✅ | Install packages |
| `/sessions` | GET | ✅ | List active sessions |

## Examples

**Execute command:**
```bash
curl -u admin:password -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

**Install package:**
```bash
curl -u admin:password -X POST http://localhost:3000/install \
  -H "Content-Type: application/json" \
  -d '{"package": "python3-pip", "manager": "apt"}'
```

## Security

- All authentication via HTTP Basic Auth
- Credentials stored in environment variables (never in code)
- Rate limiting (120 requests/minute per IP)
- Command timeout (60 seconds)
- Output size limit (50MB)

## License

MIT
