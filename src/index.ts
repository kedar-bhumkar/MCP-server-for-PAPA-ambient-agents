import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import { parse } from "url";
import { generateSqlFromMessage } from "./llm.js";
import { executeQuery } from "./db.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Hardcoded Bearer token for authentication as per requirements.
 */
const AUTH_TOKEN = "";
const PORT = process.env.PORT || 3000;


/**
 * MCP Server implementation.
 */
const server = new Server(
  {
    name: "mcp-for-papa-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Tool definitions.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_agent_output",
        description: "Returns a message back with the current server time. Accepts a user_message string.",
        inputSchema: {
          type: "object",
          properties: {
            user_message: {
              type: "string",
              description: "The message from the user",
            },
          },
          required: ["user_message"],
        },
      },
      {
        name: "get_event_data",
        description: "Translates a natural language query into SQL and executes it against the event database.",
        inputSchema: {
          type: "object",
          properties: {
            user_message: {
              type: "string",
              description: "The natural language query from the user",
            },
          },
          required: ["user_message"],
        },
      },
    ],
  };
});

/**
 * Tool execution handler.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_agent_output") {
    const userMessage = (request.params.arguments as any)?.user_message;
    console.log(`User message: ${userMessage}`);
    const now = new Date().toLocaleTimeString();
    return {
      content: [
        {
          type: "text",
          text: `The current time is ${now}. You said: ${userMessage}`,
        },
      ],
    };
  }

  if (request.params.name === "get_event_data") {
    const userMessage = (request.params.arguments as any)?.user_message;
    
    try {
      // 1. Generate SQL from user message using LLM
      const sql = await generateSqlFromMessage(
        userMessage,
      );
      
      console.log(`Generated SQL: ${sql}`);

      // 2. Execute the SQL against the database
      const data = await executeQuery(sql);
      
      console.log(`Data: ${JSON.stringify(data, null, 2)}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error(`Error in get_event_data: ${error.message}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

/**
 * Lifecycle management.
 */
server.oninitialized = () => {
  console.log("MCP Server initialized");
};

server.onerror = (error) => {
  console.error("MCP Server Error:", error);
};

/**
 * Authentication helper.
 */
function isAuthorized(req: http.IncomingMessage): boolean {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  return token === AUTH_TOKEN;
}

/**
 * SSE Transport Storage.
 * Since SSE uses multiple requests (GET for stream, POST for messages), 
 * we need to map session IDs to transport instances.
 */
const transports = new Map<string, SSEServerTransport>();

/**
 * HTTP Server for SSE.
 */
const httpServer = http.createServer(async (req, res) => {
  const { pathname, query } = parse(req.url || "", true);

  // // Authentication check for all MCP endpoints
  // if (!isAuthorized(req)) {
  //   console.log(`Unauthorized access attempt to ${pathname}`);
  //   res.writeHead(401).end("Unauthorized: Invalid or missing Bearer token");
  //   return;
  // }

  // SSE setup endpoint (GET /sse)
  if (req.method === "GET" && pathname === "/sse") {
    console.log("New SSE connection request");
    const transport = new SSEServerTransport("/message", res);
    
    // Store transport by its session ID
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    // Clean up when transport closes
    transport.onclose = () => {
      console.log(`SSE connection ${sessionId} closed`);
      transports.delete(sessionId);
    };

    // Connect the server to this transport
    await server.connect(transport);
    return;
  }

  // Message endpoint (POST /message)
  if (req.method === "POST" && pathname === "/message") {
    const sessionId = query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      res.writeHead(404).end("Session not found");
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling POST message:", error);
      res.writeHead(500).end("Internal Server Error");
    }
    return;
  }

  // Default response
  res.writeHead(200);
  res.end("MCP Server is running with SSE. Connect via GET /sse");
});

/**
 * Start the server.
 */
httpServer.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/message`);
  console.log(`Authentication: Bearer ${AUTH_TOKEN}`);
});
