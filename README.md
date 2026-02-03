# Mangobot Email Service

This is a serverless email sending service built with Cloudflare Pages Functions and Resend.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment variables file:
   Copy `.dev.vars.example` to `.dev.vars` and fill in your Resend API key.
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   *Note: In production (Cloudflare Dashboard), you will set these variables in the Settings -> Environment variables section.*

## Development

Run the local development server:

```bash
npm run dev
```

This will start the server at `http://localhost:8788`.

## API Usage

### Send Email

**Endpoint:** `POST /api/send`

**Body:**

```json
{
  "to": "recipient@example.com",
  "subject": "Hello World",
  "html": "<p>This is a test email from Mangobot.</p>",
  "text": "This is a test email from Mangobot."
}
```

**Response:**

Success (200 OK):
```json
{
  "message": "Email sent successfully",
  "id": "re_123..."
}
```

Error:
```json
{
  "error": "Error message description"
}
```

## Deployment

This project is configured to be deployed on Cloudflare Pages.

1. Connect your repository to Cloudflare Pages.
2. Build command: `npm run test` (or leave empty if you don't have a build step for static assets, usually Cloudflare detects it).
   *Actually, since this is mainly Functions, you don't need a specific build command for the functions themselves as Cloudflare handles them automatically.*
3. Build output directory: `public`.
4. Add Environment Variables in the project settings:
   - `RESEND_API_KEY`: Your Resend API Key.
   - `SENDER_EMAIL`: (Optional) Verified sender email address (e.g., `you@yourdomain.com`). Defaults to `onboarding@resend.dev` for testing.