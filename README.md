# MCP for PAPA

An implementation of the Model Context Protocol (MCP) server that provides tools for interacting with an event database and agent outputs. It uses Gemini to translate natural language queries into SQL and executes them against a PostgreSQL database.

## Features

This server provides the following MCP tools:

- `get_agent_output`: Returns a message with the current server time and echoes back the user's message.
- `get_event_data`: Translates a natural language query into SQL using Gemini and executes it against the event database.

## Prerequisites

- Node.js (v18 or higher)
- A PostgreSQL database
- A Google Gemini API Key

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
GOOGLE_AI_API_KEY=your_gemini_api_key
PORT=3000
```

## Installation

```bash
npm install
```

## Development

To run the server in development mode with automatic reloading:

```bash
npm run dev
```

The server will be available at `http://localhost:3000`.

## Building and Running

To build the project:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

## Deployment

This project is configured for deployment on [Fly.io](https://fly.io).

1. Install the Fly CLI.
2. Run `fly launch` (if not already launched).
3. Set the required secrets:
   ```bash
   fly secrets set DATABASE_URL="..." GOOGLE_AI_API_KEY="..."
   ```
4. Deploy:
   ```bash
   fly deploy
   ```

## Transport

The server uses the SSE (Server-Sent Events) transport.

- SSE Endpoint: `http://localhost:3000/sse`
- Message Endpoint: `http://localhost:3000/message`
- Authentication: Bearer token `mcp-for-PAPA` (configured in `src/index.ts`)

