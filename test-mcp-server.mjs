/**
 * Comprehensive test script for JMeter MCP Server
 * Tests all tools by simulating MCP protocol messages
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

const TEST_FILE = 'test-plan.jmx';

// Start the MCP server as a child process
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

let messageId = 1;
let responseBuffer = '';

// Parse JSON-RPC responses
function parseResponses(data) {
  responseBuffer += data;
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  
  const responses = [];
  for (const line of lines) {
    if (line.trim()) {
      try {
        responses.push(JSON.parse(line));
      } catch (e) {
        // Skip non-JSON lines
      }
    }
  }
  return responses;
}

// Send a JSON-RPC request
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  server.stdin.write(JSON.stringify(request) + '\n');
  return request.id;
}

// Wait for response with specific ID
function waitForResponse(id, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for response ${id}`)), timeout);
    
    const handler = (data) => {
      const responses = parseResponses(data.toString());
      for (const resp of responses) {
        if (resp.id === id) {
          clearTimeout(timer);
          server.stdout.off('data', handler);
          resolve(resp);
          return;
        }
      }
    };
    
    server.stdout.on('data', handler);
  });
}

// Test helper
async function runTest(name, method, params) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log('='.repeat(60));
  
  const id = sendRequest(method, params);
  try {
    const response = await waitForResponse(id);
    
    if (response.error) {
      console.log(`❌ FAILED: ${response.error.message}`);
      return false;
    }
    
    console.log(`✅ PASSED`);
    if (response.result) {
      if (response.result.tools) {
        console.log(`   Found ${response.result.tools.length} tools:`);
        response.result.tools.forEach(t => console.log(`   - ${t.name}`));
      } else if (response.result.content) {
        const text = response.result.content[0]?.text || '';
        console.log(`   ${text.split('\n')[0]}`);
      } else {
        console.log(`   Result: ${JSON.stringify(response.result).substring(0, 100)}...`);
      }
    }
    return true;
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    return false;
  }
}

// Main test sequence
async function runTests() {
  console.log('\n🚀 JMeter MCP Server - Comprehensive Test Suite\n');
  
  // Wait for server to start
  await new Promise(r => setTimeout(r, 1000));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Initialize protocol
  console.log('\n📋 Phase 1: Protocol Initialization');
  const initId = sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  });
  
  try {
    const initResp = await waitForResponse(initId);
    if (initResp.result) {
      console.log('✅ Server initialized successfully');
      console.log(`   Server: ${initResp.result.serverInfo?.name} v${initResp.result.serverInfo?.version}`);
      passed++;
    } else {
      console.log('❌ Initialization failed');
      failed++;
    }
  } catch (e) {
    console.log(`❌ Initialization error: ${e.message}`);
    failed++;
  }
  
  // Test 2: List tools
  console.log('\n📋 Phase 2: Tool Discovery');
  if (await runTest('List Available Tools', 'tools/list', {})) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 3: Create test plan
  console.log('\n📋 Phase 3: JMX Construction Tests');
  
  if (await runTest('Create Test Plan', 'tools/call', {
    name: 'jmeter_init_plan',
    arguments: { filename: TEST_FILE }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 4: Add thread group
  if (await runTest('Add Thread Group (50 users, 10s ramp, 5 loops)', 'tools/call', {
    name: 'jmeter_add_thread_group',
    arguments: {
      filename: TEST_FILE,
      num_threads: 50,
      ramp_time: 10,
      loops: 5
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 5: Add headers
  if (await runTest('Add HTTP Headers', 'tools/call', {
    name: 'jmeter_add_header',
    arguments: {
      filename: TEST_FILE,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': '${__UUID()}'
      }
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 6: Add timer
  if (await runTest('Add Timer (500ms constant + 200ms random)', 'tools/call', {
    name: 'jmeter_add_timer',
    arguments: {
      filename: TEST_FILE,
      delay_ms: 500,
      random_delay_ms: 200
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 7: Add HTTP sampler - GET request
  if (await runTest('Add HTTP GET Sampler', 'tools/call', {
    name: 'jmeter_add_sampler',
    arguments: {
      filename: TEST_FILE,
      domain: 'jsonplaceholder.typicode.com',
      path: '/posts/${__Random(1,100)}',
      method: 'GET',
      parameters: {}
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 8: Add HTTP sampler - POST request
  if (await runTest('Add HTTP POST Sampler', 'tools/call', {
    name: 'jmeter_add_sampler',
    arguments: {
      filename: TEST_FILE,
      domain: 'jsonplaceholder.typicode.com',
      path: '/posts',
      method: 'POST',
      parameters: {
        title: 'Test Post ${__threadNum}',
        body: 'Load test content ${__time()}',
        userId: '${__Random(1,10)}'
      }
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 9: Add assertion
  if (await runTest('Add Response Code Assertion (200)', 'tools/call', {
    name: 'jmeter_add_assertion',
    arguments: {
      filename: TEST_FILE,
      test_field: 'response_code',
      pattern: '200',
      is_regex: false
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 10: Add listener
  if (await runTest('Add Summary Report Listener', 'tools/call', {
    name: 'jmeter_add_listener',
    arguments: {
      filename: TEST_FILE,
      listener_type: 'summary'
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 11: Add aggregate listener
  if (await runTest('Add Aggregate Report Listener', 'tools/call', {
    name: 'jmeter_add_listener',
    arguments: {
      filename: TEST_FILE,
      listener_type: 'aggregate'
    }
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Generated: ${TEST_FILE}`);
  console.log('='.repeat(60));
  
  // Cleanup
  server.kill();
  process.exit(failed > 0 ? 1 : 0);
}

// Handle server stderr (debug output)
server.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[SERVER] ${msg}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Run tests
runTests().catch(err => {
  console.error('Test error:', err);
  server.kill();
  process.exit(1);
});
