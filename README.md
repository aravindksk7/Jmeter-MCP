# JMeter Architect MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to construct and execute JMeter test plans programmatically.

## Features

- **Create JMeter Test Plans**: Initialize new `.jmx` files with proper XML structure
- **Configure Thread Groups**: Set up virtual users with customizable thread counts, ramp-up times, and loop counts
- **Add HTTP Samplers**: Configure HTTP requests with domains, paths, methods, and parameters
- **Manage Headers**: Add HTTP Header Managers for authentication tokens, content types, etc.
- **Add Listeners**: Include Summary Report, Aggregate Report, or View Results Tree
- **Configure Timers**: Add constant or random delays between requests
- **Add Assertions**: Verify response data, status codes, or headers
- **Execute Tests**: Run test plans in non-GUI mode and get results

## Installation

```bash
npm install
npm run build
```

## MCP Configuration

Add the following to your MCP client configuration (e.g., Claude Desktop, VS Code, etc.):

### Windows

```json
{
  "mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": [
        "C:\\path\\to\\jmeter-mcp\\dist\\index.js"
      ],
      "env": {
        "PATH": "%PATH%;C:\\path\\to\\apache-jmeter\\bin"
      },
      "description": "JMeter Architect: Build and execute JMeter test plans via MCP",
      "disabled": false,
      "alwaysAllow": [
        "jmeter_init_plan",
        "jmeter_add_thread_group",
        "jmeter_add_sampler",
        "jmeter_add_header",
        "jmeter_add_listener",
        "jmeter_add_timer",
        "jmeter_add_assertion",
        "jmeter_run_test"
      ]
    }
  }
}
```

### macOS / Linux

```json
{
  "mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": [
        "/absolute/path/to/jmeter-mcp/dist/index.js"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/path/to/apache-jmeter/bin"
      },
      "description": "JMeter Architect: Build and execute JMeter test plans via MCP",
      "disabled": false,
      "alwaysAllow": [
        "jmeter_init_plan",
        "jmeter_add_thread_group",
        "jmeter_add_sampler",
        "jmeter_add_header",
        "jmeter_add_listener",
        "jmeter_add_timer",
        "jmeter_add_assertion",
        "jmeter_run_test"
      ]
    }
  }
}
```

## Available Tools

### `jmeter_init_plan`
Creates a fresh, empty JMX test plan file.

**Parameters:**
- `filename` (string, required): The name of the .jmx file to create

### `jmeter_add_thread_group`
Adds a Thread Group to define virtual users.

**Parameters:**
- `filename` (string, required): The .jmx file to modify
- `num_threads` (number, required): Number of virtual users
- `ramp_time` (number, required): Ramp-up time in seconds
- `loops` (number, required): Number of iterations (-1 for infinite)

### `jmeter_add_sampler`
Adds an HTTP Sampler (request) to the test plan.

**Parameters:**
- `filename` (string, required): The .jmx file to modify
- `domain` (string, required): Server domain (e.g., 'api.example.com')
- `path` (string, required): Request path (e.g., '/api/login')
- `method` (string, required): HTTP method ('GET', 'POST', etc.)
- `parameters` (object, required): Request parameters as key-value pairs

### `jmeter_add_header`
Adds an HTTP Header Manager.

**Parameters:**
- `filename` (string, required): The .jmx file to modify
- `headers` (object, required): Headers as key-value pairs

### `jmeter_add_listener`
Adds a result listener to collect test data.

**Parameters:**
- `filename` (string, required): The .jmx file to modify
- `listener_type` (string, required): One of 'summary', 'aggregate', or 'results_tree'

### `jmeter_add_timer`
Adds a timer for delays between requests.

**Parameters:**
- `filename` (string, required): The .jmx file to modify
- `delay_ms` (number, required): Constant delay in milliseconds
- `random_delay_ms` (number, optional): Random additional delay

### `jmeter_add_assertion`
Adds a Response Assertion to verify responses.

**Parameters:**
- `filename` (string, required): The .jmx file to modify
- `test_field` (string, required): 'response_data', 'response_code', or 'response_headers'
- `pattern` (string, required): Pattern to match
- `is_regex` (boolean, optional): Whether pattern is a regex (default: false)

### `jmeter_run_test`
Executes a JMeter test plan in non-GUI mode.

**Parameters:**
- `filename` (string, required): The .jmx file to execute
- `output_file` (string, optional): Path for results file

## Example Usage

Here's how an AI assistant might use these tools to create a load test:

1. **Initialize a test plan:**
   ```
   jmeter_init_plan(filename: "api-load-test.jmx")
   ```

2. **Add virtual users:**
   ```
   jmeter_add_thread_group(filename: "api-load-test.jmx", num_threads: 100, ramp_time: 30, loops: 10)
   ```

3. **Add headers:**
   ```
   jmeter_add_header(filename: "api-load-test.jmx", headers: {"Content-Type": "application/json", "Authorization": "Bearer ${token}"})
   ```

4. **Add an HTTP request:**
   ```
   jmeter_add_sampler(filename: "api-load-test.jmx", domain: "api.example.com", path: "/v1/users", method: "GET", parameters: {})
   ```

5. **Add a summary report:**
   ```
   jmeter_add_listener(filename: "api-load-test.jmx", listener_type: "summary")
   ```

6. **Run the test:**
   ```
   jmeter_run_test(filename: "api-load-test.jmx")
   ```

## Requirements

- Node.js 18+
- Apache JMeter (required for `jmeter_run_test` tool)
- JMeter must be in PATH or specify full path in MCP configuration

## License

ISC
