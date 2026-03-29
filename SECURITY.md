# Security Policy

## Supported Versions

Only the latest release published to Docker Hub is actively supported with security updates:

| Version                        | Supported |
| ------------------------------ | --------- |
| `furystack/stack-craft:latest` | Yes       |
| Older versions                 | No        |

We recommend always running the latest image to benefit from the most recent security patches.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities privately by filing a security advisory:

> [https://github.com/furystack/stack-craft/security/advisories/new](https://github.com/furystack/stack-craft/security/advisories/new)

When reporting, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected component(s) and version(s)
- Any suggested mitigation or fix

## Response Timeline

- **Acknowledgement**: within 72 hours of the report
- **Fix timeline**: within 2 weeks of confirmation, we will provide either a patch or a mitigation plan

## Scope

### In scope

- Backend service (`service/`)
- Frontend application (`frontend/`)
- MCP server (`service/src/mcp/`)
- Authentication and session handling
- Encryption and secrets management

### Out of scope

- Third-party dependencies: please report vulnerabilities in upstream packages directly to their respective maintainers
- Issues in infrastructure or hosting environments not maintained by this project

## Disclosure

We follow coordinated disclosure. We ask that reporters allow us a reasonable window to address the issue before any public disclosure.
