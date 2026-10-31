# Public Chatbot Setup

The website calls its own `/api/chat` endpoint, which sends a short-lived signed JWT to the n8n webhook. The workflow calls Gemini first and OpenAI if Gemini errors or returns no usable text. It sends only a curated set of public facts and the visitor's recent messages.

1. **Import `Thea Public AI Chat.json` into n8n**.
2. On **Chat webhook**, select or create the JWT credential using the website's `WEBHOOK_JWT_PASSPHRASE` (HS256). Authentication is required.
3. On **Gemini primary**, select a Generic Credential Type → Header Auth credential with header `x-goog-api-key` and your Gemini API key as its value. Uses `gemini-flash-lite-latest` (1,500 req/day free tier).
4. On **OpenAI fallback**, select a Header Auth credential with header `Authorization` and value `Bearer <OPENAI_API_KEY>`.
5. Review the **Prepare public context** node for the savage/rude persona and careers redirection rule pointing to `https://theasolutions.co/careers`.
6. Publish the workflow. Set `CHAT_WEBHOOK_URL` in the Next.js server environment to the production webhook URL shown in n8n.
