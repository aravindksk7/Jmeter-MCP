#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { JmxBuilder } from "./jmxBuilder.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "jmeter_init_plan",
    description: "Creates a fresh, empty JMX test plan file. This is the first step in creating a JMeter load test.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The name of the .jmx file to create, e.g., 'my-test.jmx'. Can be an absolute path or relative to the current working directory."
        }
      },
      required: ["filename"]
    }
  },
  {
    name: "jmeter_add_thread_group",
    description: "Adds a Thread Group to a JMX file. This defines a pool of virtual users that will execute the test. Must be called after jmeter_init_plan.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx file to modify."
        },
        num_threads: {
          type: "number",
          description: "The number of virtual users (threads) to simulate."
        },
        ramp_time: {
          type: "number",
          description: "The time in seconds to ramp-up all threads (gradually start them)."
        },
        loops: {
          type: "number",
          description: "How many times each user should repeat the test flow. Use -1 for infinite loops."
        }
      },
      required: ["filename", "num_threads", "ramp_time", "loops"]
    }
  },
  {
    name: "jmeter_add_sampler",
    description: "Adds an HTTP Sampler (request) to the last Thread Group in a JMX file. This represents an HTTP request that virtual users will execute.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx file to modify."
        },
        domain: {
          type: "string",
          description: "The domain name of the server, e.g., 'api.example.com'."
        },
        path: {
          type: "string",
          description: "The path of the request, e.g., '/api/login'."
        },
        method: {
          type: "string",
          description: "The HTTP method: 'GET', 'POST', 'PUT', 'DELETE', etc."
        },
        parameters: {
          type: "object",
          description: "A JSON object of request parameters. Values can include JMeter functions, e.g., {'id': '${__Random(1,100)}', 'timestamp': '${__time()}'}.",
          additionalProperties: { type: "string" }
        }
      },
      required: ["filename", "domain", "path", "method", "parameters"]
    }
  },
  {
    name: "jmeter_add_header",
    description: "Adds an HTTP Header Manager to the last Thread Group. Headers will be applied to all HTTP samplers within that group.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx file to modify."
        },
        headers: {
          type: "object",
          description: "A JSON object of headers, e.g., {'Content-Type': 'application/json', 'Authorization': 'Bearer ${token}'}.",
          additionalProperties: { type: "string" }
        }
      },
      required: ["filename", "headers"]
    }
  },
  {
    name: "jmeter_run_test",
    description: "Executes a JMeter test plan in non-GUI mode. Returns the test results summary. Requires JMeter to be installed and available in PATH.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx test plan file to execute."
        },
        output_file: {
          type: "string",
          description: "Optional: Path to save the results file (CSV/JTL format). If not provided, results are written to a default file."
        }
      },
      required: ["filename"]
    }
  },
  {
    name: "jmeter_add_listener",
    description: "Adds a listener to the test plan to collect and display results. Common listeners include Summary Report and View Results Tree.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx file to modify."
        },
        listener_type: {
          type: "string",
          enum: ["summary", "aggregate", "results_tree"],
          description: "Type of listener: 'summary' for Summary Report, 'aggregate' for Aggregate Report, 'results_tree' for View Results Tree."
        }
      },
      required: ["filename", "listener_type"]
    }
  },
  {
    name: "jmeter_add_timer",
    description: "Adds a timer to the last Thread Group to introduce delays between requests.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx file to modify."
        },
        delay_ms: {
          type: "number",
          description: "The constant delay in milliseconds between requests."
        },
        random_delay_ms: {
          type: "number",
          description: "Optional: Random additional delay (0 to this value) added to the constant delay."
        }
      },
      required: ["filename", "delay_ms"]
    }
  },
  {
    name: "jmeter_add_assertion",
    description: "Adds a Response Assertion to verify the HTTP response meets expected criteria.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The .jmx file to modify."
        },
        test_field: {
          type: "string",
          enum: ["response_data", "response_code", "response_headers"],
          description: "Which part of the response to test."
        },
        pattern: {
          type: "string",
          description: "The pattern to match against (can be substring or regex)."
        },
        is_regex: {
          type: "boolean",
          description: "Whether the pattern is a regular expression. Defaults to false (substring match)."
        }
      },
      required: ["filename", "test_field", "pattern"]
    }
  }
];

// Tool handler implementation
async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case "jmeter_init_plan": {
        const filename = args.filename as string;
        if (!filename) throw new Error("Missing required argument: filename");

        const builder = await JmxBuilder.create(filename);
        await builder.save(filename);

        return {
          content: [{
            type: "text",
            text: `✅ Successfully initialized new JMeter test plan: ${filename}\n\nNext steps:\n1. Add a Thread Group using jmeter_add_thread_group\n2. Add HTTP samplers using jmeter_add_sampler\n3. Optionally add headers, timers, or assertions`
          }]
        };
      }

      case "jmeter_add_thread_group": {
        const { filename, num_threads, ramp_time, loops } = args as {
          filename: string;
          num_threads: number;
          ramp_time: number;
          loops: number;
        };
        
        if (!filename || num_threads === undefined || ramp_time === undefined || loops === undefined) {
          throw new Error("Missing required arguments: filename, num_threads, ramp_time, loops");
        }

        const builder = await JmxBuilder.load(filename);
        builder.addThreadGroup(num_threads, ramp_time, loops);
        await builder.save(filename);

        return {
          content: [{
            type: "text",
            text: `✅ Added Thread Group to ${filename}\n\nConfiguration:\n- Virtual Users (threads): ${num_threads}\n- Ramp-up Time: ${ramp_time} seconds\n- Loop Count: ${loops === -1 ? 'Infinite' : loops}`
          }]
        };
      }

      case "jmeter_add_sampler": {
        const { filename, domain, path: urlPath, method, parameters } = args as {
          filename: string;
          domain: string;
          path: string;
          method: string;
          parameters: Record<string, string>;
        };
        
        if (!filename || !domain || !urlPath || !method || parameters === undefined) {
          throw new Error("Missing required arguments: filename, domain, path, method, parameters");
        }

        const builder = await JmxBuilder.load(filename);
        builder.addHttpSampler(domain, urlPath, method, parameters || {});
        await builder.save(filename);

        return {
          content: [{
            type: "text",
            text: `✅ Added HTTP Sampler to ${filename}\n\nRequest Configuration:\n- URL: ${domain}${urlPath}\n- Method: ${method}\n- Parameters: ${JSON.stringify(parameters, null, 2)}`
          }]
        };
      }

      case "jmeter_add_header": {
        const { filename, headers } = args as {
          filename: string;
          headers: Record<string, string>;
        };
        
        if (!filename || !headers) {
          throw new Error("Missing required arguments: filename, headers");
        }

        const builder = await JmxBuilder.load(filename);
        builder.addHeaderManager(headers);
        await builder.save(filename);

        return {
          content: [{
            type: "text",
            text: `✅ Added HTTP Header Manager to ${filename}\n\nHeaders:\n${Object.entries(headers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
          }]
        };
      }

      case "jmeter_run_test": {
        const { filename, output_file } = args as {
          filename: string;
          output_file?: string;
        };
        
        if (!filename) {
          throw new Error("Missing required argument: filename");
        }

        const resultsFile = output_file || filename.replace('.jmx', '_results.jtl');
        const logFile = filename.replace('.jmx', '.log');
        
        try {
          const { stdout, stderr } = await execAsync(
            `jmeter -n -t "${filename}" -l "${resultsFile}" -j "${logFile}"`,
            { timeout: 300000 } // 5 minute timeout
          );
          
          return {
            content: [{
              type: "text",
              text: `✅ JMeter test completed!\n\nTest Plan: ${filename}\nResults File: ${resultsFile}\nLog File: ${logFile}\n\nOutput:\n${stdout}\n${stderr ? `\nStderr:\n${stderr}` : ''}`
            }]
          };
        } catch (execError: any) {
          return {
            content: [{
              type: "text",
              text: `❌ JMeter test execution failed:\n${execError.message}\n\nMake sure JMeter is installed and available in PATH.\nYou can download it from: https://jmeter.apache.org/download_jmeter.cgi`
            }],
            isError: true
          };
        }
      }

      case "jmeter_add_listener": {
        const { filename, listener_type } = args as {
          filename: string;
          listener_type: string;
        };
        
        if (!filename || !listener_type) {
          throw new Error("Missing required arguments: filename, listener_type");
        }

        const builder = await JmxBuilder.load(filename);
        builder.addListener(listener_type);
        await builder.save(filename);

        const listenerNames: Record<string, string> = {
          summary: 'Summary Report',
          aggregate: 'Aggregate Report',
          results_tree: 'View Results Tree'
        };

        return {
          content: [{
            type: "text",
            text: `✅ Added ${listenerNames[listener_type] || listener_type} listener to ${filename}`
          }]
        };
      }

      case "jmeter_add_timer": {
        const { filename, delay_ms, random_delay_ms } = args as {
          filename: string;
          delay_ms: number;
          random_delay_ms?: number;
        };
        
        if (!filename || delay_ms === undefined) {
          throw new Error("Missing required arguments: filename, delay_ms");
        }

        const builder = await JmxBuilder.load(filename);
        builder.addTimer(delay_ms, random_delay_ms || 0);
        await builder.save(filename);

        return {
          content: [{
            type: "text",
            text: `✅ Added Timer to ${filename}\n\nConfiguration:\n- Constant Delay: ${delay_ms}ms${random_delay_ms ? `\n- Random Delay: 0-${random_delay_ms}ms` : ''}`
          }]
        };
      }

      case "jmeter_add_assertion": {
        const { filename, test_field, pattern, is_regex } = args as {
          filename: string;
          test_field: string;
          pattern: string;
          is_regex?: boolean;
        };
        
        if (!filename || !test_field || !pattern) {
          throw new Error("Missing required arguments: filename, test_field, pattern");
        }

        const builder = await JmxBuilder.load(filename);
        builder.addAssertion(test_field, pattern, is_regex || false);
        await builder.save(filename);

        return {
          content: [{
            type: "text",
            text: `✅ Added Response Assertion to ${filename}\n\nConfiguration:\n- Test Field: ${test_field}\n- Pattern: ${pattern}\n- Match Type: ${is_regex ? 'Regular Expression' : 'Substring'}`
          }]
        };
      }

      default:
        return {
          content: [{
            type: "text",
            text: `❌ Unknown tool: ${name}`
          }],
          isError: true
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `❌ Error executing ${name}: ${errorMessage}`
      }],
      isError: true
    };
  }
}

// Create and configure the MCP server
const server = new Server(
  {
    name: "jmeter-architect",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args || {});
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("JMeter Architect MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});