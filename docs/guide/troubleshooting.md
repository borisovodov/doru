# Troubleshooting

- **“AI provider is not configured”** — open Settings (gear icon in the left
  bar), pick a provider, and follow the wizard: fetch the model list (or pick
  a model) and save a key where required.
- **Ollama connection fails** — select the Ollama preset (base URL
  `http://localhost:11434/v1`); no API key is needed. Press “Fetch models
  from the provider” — if it reports the provider is unreachable, make sure
  Ollama is running locally.
