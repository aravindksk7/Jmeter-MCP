# JMeter Architect MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to construct and execute JMeter test plans programmatically.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [VS Code Setup](#vs-code-setup)
  - [Step 1: Configure MCP Settings](#step-1-configure-mcp-settings)
  - [Step 2: Restart VS Code](#step-2-restart-vs-code)
  - [Step 3: Verify Server Connection](#step-3-verify-server-connection)
- [Available Tools](#available-tools)
- [Usage Examples](#usage-examples)
  - [Basic Load Test](#basic-load-test)
  - [API Testing with Authentication](#api-testing-with-authentication)
  - [Stress Test with Assertions](#stress-test-with-assertions)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- **Create JMeter Test Plans**: Initialize new `.jmx` files with proper XML structure
- **Configure Thread Groups**: Set up virtual users with customizable thread counts, ramp-up times, and loop counts
- **Add HTTP Samplers**: Configure HTTP requests with domains, paths, methods, and parameters
- **Manage Headers**: Add HTTP Header Managers for authentication tokens, content types, etc.
- **Add Listeners**: Include Summary Report, Aggregate Report, or View Results Tree
- **Configure Timers**: Add constant or random delays between requests
- **Add Assertions**: Verify response data, status codes, or headers
- **Execute Tests**: Run test plans in non-GUI mode and get results

## Prerequisites

Before setting up the JMeter MCP Server, ensure you have:

1. **Node.js 18+** - [Download Node.js](https://nodejs.org/)
2. **VS Code** with GitHub Copilot extension
3. **Apache JMeter** (optional, only required for `jmeter_run_test` tool) - [Download JMeter](https://jmeter.apache.org/download_jmeter.cgi)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aravindksk7/Jmeter-MCP.git
   cd Jmeter-MCP
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Note the full path** to `dist/index.js` - you'll need this for VS Code configuration.

---

## VS Code Setup

### Step 1: Configure MCP Settings

Open VS Code settings and configure the MCP server. You can do this in two ways:

#### Option A: Using VS Code Settings UI

1. Open VS Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
3. Type "Preferences: Open User Settings (JSON)" and select it
4. Add the MCP configuration (see JSON below)

#### Option B: Edit settings.json directly

Navigate to your VS Code settings file:
- **Windows**: `%APPDATA%\Code\User\settings.json`
- **macOS**: `~/Library/Application Support/Code/User/settings.json`
- **Linux**: `~/.config/Code/User/settings.json`

Add the following configuration:

#### Windows Configuration

```json
{
  "github.copilot.chat.mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\path\\to\\Jmeter-MCP\\dist\\index.js"
      ],
      "env": {
        "PATH": "%PATH%;C:\\apache-jmeter\\bin"
      }
    }
  }
}
```

#### macOS Configuration

```json
{
  "github.copilot.chat.mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": [
        "/Users/YourUsername/path/to/Jmeter-MCP/dist/index.js"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/path/to/apache-jmeter/bin"
      }
    }
  }
}
```

#### Linux Configuration

```json
{
  "github.copilot.chat.mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": [
        "/home/YourUsername/path/to/Jmeter-MCP/dist/index.js"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin:/opt/jmeter/bin"
      }
    }
  }
}
```

> **Important**: Replace `YourUsername` and paths with your actual values. Use absolute paths, not relative paths.

### Step 2: Restart VS Code

After adding the configuration:
1. Save the `settings.json` file
2. Completely close VS Code
3. Reopen VS Code

### Step 3: Verify Server Connection

1. Open GitHub Copilot Chat (`Ctrl+Shift+I` or `Cmd+Shift+I`)
2. Click on the **tools icon** (wrench/hammer) in the chat panel
3. You should see **jmeter-architect** listed with 8 available tools:
   - `jmeter_init_plan`
   - `jmeter_add_thread_group`
   - `jmeter_add_sampler`
   - `jmeter_add_header`
   - `jmeter_add_listener`
   - `jmeter_add_timer`
   - `jmeter_add_assertion`
   - `jmeter_run_test`

If the server appears with a green indicator, you're ready to use it!

---

## Available Tools

| Tool | Description |
|------|-------------|
| `jmeter_init_plan` | Creates a fresh, empty JMX test plan file |
| `jmeter_add_thread_group` | Adds a Thread Group to define virtual users |
| `jmeter_add_sampler` | Adds an HTTP Sampler (request) to the test plan |
| `jmeter_add_header` | Adds an HTTP Header Manager |
| `jmeter_add_listener` | Adds a result listener to collect test data |
| `jmeter_add_timer` | Adds a timer for delays between requests |
| `jmeter_add_assertion` | Adds a Response Assertion to verify responses |
| `jmeter_run_test` | Executes a JMeter test plan in non-GUI mode |

### Tool Parameters Reference

#### `jmeter_init_plan`
Creates a fresh, empty JMX test plan file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The name of the .jmx file to create |

#### `jmeter_add_thread_group`
Adds a Thread Group to define virtual users.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to modify |
| `num_threads` | number | ✅ | Number of virtual users |
| `ramp_time` | number | ✅ | Ramp-up time in seconds |
| `loops` | number | ✅ | Number of iterations (-1 for infinite) |

#### `jmeter_add_sampler`
Adds an HTTP Sampler (request) to the test plan.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to modify |
| `domain` | string | ✅ | Server domain (e.g., 'api.example.com') |
| `path` | string | ✅ | Request path (e.g., '/api/login') |
| `method` | string | ✅ | HTTP method ('GET', 'POST', etc.) |
| `parameters` | object | ✅ | Request parameters as key-value pairs |

#### `jmeter_add_header`
Adds an HTTP Header Manager.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to modify |
| `headers` | object | ✅ | Headers as key-value pairs |

#### `jmeter_add_listener`
Adds a result listener to collect test data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to modify |
| `listener_type` | string | ✅ | One of 'summary', 'aggregate', or 'results_tree' |

#### `jmeter_add_timer`
Adds a timer for delays between requests.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to modify |
| `delay_ms` | number | ✅ | Constant delay in milliseconds |
| `random_delay_ms` | number | ❌ | Random additional delay |

#### `jmeter_add_assertion`
Adds a Response Assertion to verify responses.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to modify |
| `test_field` | string | ✅ | 'response_data', 'response_code', or 'response_headers' |
| `pattern` | string | ✅ | Pattern to match |
| `is_regex` | boolean | ❌ | Whether pattern is a regex (default: false) |

#### `jmeter_run_test`
Executes a JMeter test plan in non-GUI mode.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | ✅ | The .jmx file to execute |
| `output_file` | string | ❌ | Path for results file |

---

## Usage Examples

### Using with GitHub Copilot Chat

Once configured, you can interact with the JMeter MCP Server through natural language in GitHub Copilot Chat. Here are some example prompts:

#### Creating a Simple Load Test

**Prompt:**
```
Create a JMeter test plan called "api-test.jmx" with 50 users, 
10 second ramp-up, running 5 iterations. Test the endpoint 
GET https://jsonplaceholder.typicode.com/posts and add a summary report.
```

**What Copilot will do:**
1. Call `jmeter_init_plan` to create the test file
2. Call `jmeter_add_thread_group` with 50 threads, 10s ramp-up, 5 loops
3. Call `jmeter_add_sampler` for the GET request
4. Call `jmeter_add_listener` with summary report

---

### Basic Load Test

Create a simple load test for a REST API:

```
User: Create a load test for https://api.example.com/users with 100 concurrent users

Copilot will execute:
├── jmeter_init_plan(filename: "load-test.jmx")
├── jmeter_add_thread_group(filename: "load-test.jmx", num_threads: 100, ramp_time: 30, loops: 10)
├── jmeter_add_sampler(filename: "load-test.jmx", domain: "api.example.com", path: "/users", method: "GET", parameters: {})
└── jmeter_add_listener(filename: "load-test.jmx", listener_type: "summary")
```

---

### API Testing with Authentication

Test an authenticated API endpoint with headers:

```
User: Create a test for our authenticated API. Use Bearer token authentication,
      test POST /api/v1/orders with 20 users, and verify we get 200 response codes.

Copilot will execute:
├── jmeter_init_plan(filename: "auth-api-test.jmx")
├── jmeter_add_thread_group(filename: "auth-api-test.jmx", num_threads: 20, ramp_time: 10, loops: 5)
├── jmeter_add_header(filename: "auth-api-test.jmx", headers: {
│     "Authorization": "Bearer ${token}",
│     "Content-Type": "application/json"
│   })
├── jmeter_add_sampler(filename: "auth-api-test.jmx", domain: "api.example.com", 
│     path: "/api/v1/orders", method: "POST", 
│     parameters: {"item": "product-123", "quantity": "1"})
├── jmeter_add_assertion(filename: "auth-api-test.jmx", test_field: "response_code", pattern: "200")
└── jmeter_add_listener(filename: "auth-api-test.jmx", listener_type: "aggregate")
```

---

### Stress Test with Assertions

Create a comprehensive stress test with think time and assertions:

```
User: Build a stress test for our checkout API with these requirements:
      - 200 concurrent users over 60 seconds
      - Random delay of 500-1500ms between requests
      - Test POST /checkout endpoint
      - Assert response contains "success"
      - Include both summary and aggregate reports

Copilot will execute:
├── jmeter_init_plan(filename: "stress-test.jmx")
├── jmeter_add_thread_group(filename: "stress-test.jmx", num_threads: 200, ramp_time: 60, loops: -1)
├── jmeter_add_header(filename: "stress-test.jmx", headers: {"Content-Type": "application/json"})
├── jmeter_add_timer(filename: "stress-test.jmx", delay_ms: 500, random_delay_ms: 1000)
├── jmeter_add_sampler(filename: "stress-test.jmx", domain: "api.example.com", 
│     path: "/checkout", method: "POST", parameters: {"cart_id": "${cartId}"})
├── jmeter_add_assertion(filename: "stress-test.jmx", test_field: "response_data", 
│     pattern: "success", is_regex: false)
├── jmeter_add_listener(filename: "stress-test.jmx", listener_type: "summary")
└── jmeter_add_listener(filename: "stress-test.jmx", listener_type: "aggregate")
```

---

### Running Tests

After creating a test plan, you can run it:

```
User: Run the stress-test.jmx test plan

Copilot will execute:
└── jmeter_run_test(filename: "stress-test.jmx", output_file: "results.jtl")
```

> **Note**: The `jmeter_run_test` tool requires Apache JMeter to be installed and in your PATH.

---

## Troubleshooting

### Server Not Appearing in VS Code

1. **Check the path**: Ensure the path to `dist/index.js` is absolute and correct
2. **Rebuild the project**: Run `npm run build` again
3. **Check settings.json syntax**: Ensure valid JSON (no trailing commas)
4. **Restart VS Code**: Completely close and reopen

### "Command not found: node"

Ensure Node.js is installed and in your system PATH:
```bash
node --version  # Should show v18 or higher
```

### JMX Files Not Being Created

1. Check that the working directory has write permissions
2. Ensure the filename ends with `.jmx`
3. Check VS Code's Output panel for error messages

### "jmeter: command not found" when running tests

The `jmeter_run_test` tool requires Apache JMeter:
1. Download and install [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi)
2. Add JMeter's `bin` directory to your PATH
3. Update the `env.PATH` in your VS Code settings

### Server Shows Red/Disconnected

1. Check the VS Code Output panel (View → Output → select "MCP" or "GitHub Copilot")
2. Look for error messages in the server startup
3. Try running the server manually to debug:
   ```bash
   node dist/index.js
   ```

### Tools Not Working as Expected

1. Ensure you're calling tools with correct parameter types
2. Check that required parameters are provided
3. Verify the .jmx filename is consistent across calls

---

## Claude Desktop Configuration

If you're using Claude Desktop instead of VS Code, add this to your `claude_desktop_config.json`:

### Windows
```json
{
  "mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": ["C:\\path\\to\\Jmeter-MCP\\dist\\index.js"],
      "env": {
        "PATH": "%PATH%;C:\\apache-jmeter\\bin"
      }
    }
  }
}
```

### macOS
Config location: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "jmeter-architect": {
      "command": "node",
      "args": ["/path/to/Jmeter-MCP/dist/index.js"],
      "env": {
        "PATH": "/usr/local/bin:/opt/homebrew/bin:/path/to/jmeter/bin"
      }
    }
  }
}
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License - see [LICENSE](LICENSE) file for details.

## Author

**aravindksk7**

---

<p align="center">Made with ❤️ for the performance testing community</p>
