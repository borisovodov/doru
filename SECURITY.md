# Security Policy

## Reporting a vulnerability

Doru is maintained by a small team. If you believe you have found a security
vulnerability, please report it privately — do not open a public issue.

Report vulnerabilities by email to:

**boris@ovodov.me**

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof of concept
- Affected version(s)
- Any suggested mitigations

## What to expect

- You will receive an acknowledgement as soon as possible.
- We will work with you to understand and validate the issue.
- We will release a fix as soon as we can and credit you in the release notes
  (unless you prefer to remain anonymous).

## Scope

In scope:

- The Doru desktop application (Electron shell, renderer, core domain logic)
- Data safety and integrity of `*.doru` project folders
- The MCP server surface (planned) and agent permission system
- Handling of untrusted input: GEDCOM files, project folders, settings files

Out of scope:

- Vulnerabilities in third-party dependencies that are not exploitable through
  Doru itself (report those upstream)
- Theoretical issues without a concrete impact

## Preferred language

English.
