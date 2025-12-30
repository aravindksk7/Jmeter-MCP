
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as xml2js from 'xml2js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class JmxBuilder {
    private jmxStructure: any;
    private parser = new xml2js.Parser({ explicitArray: true });
    private xmlBuilder = new xml2js.Builder({ 
        headless: false,
        renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    });

    private constructor() {}

    static async create(testPlanName: string): Promise<JmxBuilder> {
        const builder = new JmxBuilder();
        let templatePath = path.join(__dirname, '..', 'templates', 'skeleton.xml');
        try {
            await fs.access(templatePath);
        } catch {
            templatePath = path.join(process.cwd(), 'templates', 'skeleton.xml');
        }
        const template = await fs.readFile(templatePath, 'utf-8');
        builder.jmxStructure = await builder.parser.parseStringPromise(template);
        builder.jmxStructure.jmeterTestPlan.hashTree[0].TestPlan[0].$.testname = testPlanName;
        return builder;
    }

    static async load(filepath: string): Promise<JmxBuilder> {
        const builder = new JmxBuilder();
        const xml = await fs.readFile(filepath, 'utf-8');
        builder.jmxStructure = await builder.parser.parseStringPromise(xml);
        return builder;
    }

    /**
     * Gets the hashTree array that sits under TestPlan (where ThreadGroups go)
     * This is jmeterTestPlan > hashTree[0] > hashTree
     */
    private getTestPlanChildHashTree(): any[] {
        const rootHashTree = this.jmxStructure.jmeterTestPlan.hashTree[0];
        
        // The hashTree element after TestPlan - can be array or single item
        if (!rootHashTree.hashTree) {
            rootHashTree.hashTree = [''];
        }
        
        // xml2js stores multiple hashTree as array items
        // We need the first one (which is the sibling of TestPlan)
        let testPlanHashTree = rootHashTree.hashTree;
        if (!Array.isArray(testPlanHashTree)) {
            rootHashTree.hashTree = [testPlanHashTree];
            testPlanHashTree = rootHashTree.hashTree;
        }
        
        return testPlanHashTree;
    }

    /**
     * Find the container object that holds children of the last ThreadGroup.
     * In xml2js, children are stored as properties of an object:
     * { HeaderManager: [...], HTTPSamplerProxy: [...], hashTree: ['', '', ...] }
     * Returns the object where child elements should be added as properties.
     */
    private getThreadGroupChildContainer(): any | null {
        const testPlanHashTree = this.getTestPlanChildHashTree();
        
        // Find the last ThreadGroup
        for (let i = testPlanHashTree.length - 1; i >= 0; i--) {
            const item = testPlanHashTree[i];
            
            if (item && typeof item === 'object' && !Array.isArray(item) && item.ThreadGroup) {
                // Found ThreadGroup, its children container should be at i+1
                if (i + 1 < testPlanHashTree.length) {
                    let childContainer = testPlanHashTree[i + 1];
                    
                    // If it's empty string (empty hashTree) or array, convert to object
                    if (typeof childContainer === 'string' || !childContainer || Array.isArray(childContainer)) {
                        // Start with empty hashTree array that will grow as we add elements
                        testPlanHashTree[i + 1] = { hashTree: [] };
                        childContainer = testPlanHashTree[i + 1];
                    }
                    
                    // Ensure it has hashTree property as array
                    if (!childContainer.hashTree) {
                        childContainer.hashTree = [];
                    } else if (!Array.isArray(childContainer.hashTree)) {
                        childContainer.hashTree = [childContainer.hashTree];
                    }
                    
                    return childContainer;
                }
                
                // No entry after ThreadGroup, add one
                testPlanHashTree.push({ hashTree: [] });
                return testPlanHashTree[testPlanHashTree.length - 1];
            }
        }
        
        return null;
    }

    addThreadGroup(threads: number, rampup: number, loop: number) {
        const threadGroup = {
            $: {
                guiclass: "ThreadGroupGui",
                testclass: "ThreadGroup",
                testname: "MCP Generated Users",
                enabled: "true"
            },
            stringProp: [
                { $: { name: "ThreadGroup.on_sample_error" }, _: "continue" },
                { $: { name: "ThreadGroup.num_threads" }, _: String(threads) },
                { $: { name: "ThreadGroup.ramp_time" }, _: String(rampup) }
            ],
            elementProp: [{
                $: { 
                    name: "ThreadGroup.main_controller", 
                    elementType: "LoopController", 
                    guiclass: "LoopControlPanel", 
                    testclass: "LoopController", 
                    testname: "Loop Controller", 
                    enabled: "true" 
                },
                boolProp: [{ $: { name: "LoopController.continue_forever" }, _: "false" }],
                stringProp: [{ $: { name: "LoopController.loops" }, _: String(loop) }]
            }]
        };

        const testPlanHashTree = this.getTestPlanChildHashTree();
        
        // Clean up empty placeholder
        if (testPlanHashTree.length === 1 && testPlanHashTree[0] === '') {
            testPlanHashTree.length = 0;
        }

        // Add ThreadGroup
        testPlanHashTree.push({ ThreadGroup: [threadGroup] });
        // Add object placeholder for ThreadGroup's children
        // Children will be added as properties: { Element1: [...], Element2: [...], hashTree: ['', '', ...] }
        testPlanHashTree.push({ hashTree: [] });
    }

    private addChildElement(elementKey: string, elementValue: any): void {
        const container = this.getThreadGroupChildContainer();
        if (!container) {
            throw new Error("No Thread Group found. Add a Thread Group first.");
        }

        // Add element to container (will create or append to array)
        if (!container[elementKey]) {
            container[elementKey] = [elementValue];
        } else {
            container[elementKey].push(elementValue);
        }
        
        // Add empty hashTree entry for this element
        container.hashTree.push('');
    }

    addHttpSampler(domain: string, urlPath: string, method: string, params: Record<string, string>) {
        const argumentElements = Object.entries(params).map(([key, value]) => ({
            $: { name: key, elementType: "HTTPArgument" },
            boolProp: [{ $: { name: "HTTPArgument.always_encode" }, _: "false" }],
            stringProp: [
                { $: { name: "Argument.value" }, _: value },
                { $: { name: "Argument.metadata" }, _: "=" },
                { $: { name: "Argument.name" }, _: key }
            ]
        }));

        const collectionPropContent: any = { $: { name: "Arguments.arguments" } };
        if (argumentElements.length > 0) {
            collectionPropContent.elementProp = argumentElements;
        }

        const sampler = {
            $: {
                guiclass: "HttpTestSampleGui",
                testclass: "HTTPSamplerProxy",
                testname: `HTTP Request to ${urlPath}`,
                enabled: "true"
            },
            elementProp: [{
                $: { 
                    name: "HTTPsampler.Arguments", 
                    elementType: "Arguments", 
                    guiclass: "HTTPArgumentsPanel", 
                    testclass: "Arguments", 
                    testname: "User Defined Variables", 
                    enabled: "true" 
                },
                collectionProp: [collectionPropContent]
            }],
            stringProp: [
                { $: { name: "HTTPSampler.domain" }, _: domain },
                { $: { name: "HTTPSampler.port" }, _: "" },
                { $: { name: "HTTPSampler.protocol" }, _: "" },
                { $: { name: "HTTPSampler.contentEncoding" }, _: "" },
                { $: { name: "HTTPSampler.path" }, _: urlPath },
                { $: { name: "HTTPSampler.method" }, _: method },
                { $: { name: "HTTPSampler.follow_redirects" }, _: "true" },
                { $: { name: "HTTPSampler.auto_redirects" }, _: "false" },
                { $: { name: "HTTPSampler.use_keepalive" }, _: "true" },
                { $: { name: "HTTPSampler.DO_MULTIPART_POST" }, _: "false" },
                { $: { name: "HTTPSampler.embedded_url_re" }, _: "" },
                { $: { name: "HTTPSampler.connect_timeout" }, _: "" },
                { $: { name: "HTTPSampler.response_timeout" }, _: "" }
            ]
        };

        this.addChildElement('HTTPSamplerProxy', sampler);
    }

    addHeaderManager(headers: Record<string, string>) {
        const headerElements = Object.entries(headers).map(([name, value]) => ({
            $: { name: "", elementType: "Header" },
            stringProp: [
                { $: { name: "Header.name" }, _: name },
                { $: { name: "Header.value" }, _: value }
            ]
        }));

        const headerManager = {
            $: {
                guiclass: "HeaderPanel",
                testclass: "HeaderManager",
                testname: "HTTP Header Manager",
                enabled: "true"
            },
            collectionProp: [{
                $: { name: "HeaderManager.headers" },
                elementProp: headerElements
            }]
        };

        this.addChildElement('HeaderManager', headerManager);
    }

    addListener(listenerType: string): void {
        const guiClassMap: Record<string, string> = {
            'summary': 'SummaryReport',
            'aggregate': 'StatVisualizer',
            'results_tree': 'ViewResultsFullVisualizer'
        };

        const testNameMap: Record<string, string> = {
            'summary': 'Summary Report',
            'aggregate': 'Aggregate Report',
            'results_tree': 'View Results Tree'
        };

        const guiClass = guiClassMap[listenerType];
        if (!guiClass) {
            throw new Error(`Unknown listener type: ${listenerType}`);
        }

        const listener = {
            $: {
                guiclass: guiClass,
                testclass: "ResultCollector",
                testname: testNameMap[listenerType],
                enabled: "true"
            },
            boolProp: [
                { $: { name: "ResultCollector.error_logging" }, _: "false" }
            ],
            objProp: [{
                $: { name: "saveConfig" },
                value: [{
                    $: { class: "SampleSaveConfiguration" },
                    time: ["true"],
                    latency: ["true"],
                    timestamp: ["true"],
                    success: ["true"],
                    label: ["true"],
                    code: ["true"],
                    message: ["true"],
                    threadName: ["true"],
                    dataType: ["true"],
                    encoding: ["false"],
                    assertions: ["true"],
                    subresults: ["true"],
                    responseData: ["false"],
                    samplerData: ["false"],
                    xml: ["false"],
                    fieldNames: ["true"],
                    responseHeaders: ["false"],
                    requestHeaders: ["false"],
                    responseDataOnError: ["false"],
                    saveAssertionResultsFailureMessage: ["true"],
                    assertionsResultsToSave: ["0"],
                    bytes: ["true"],
                    sentBytes: ["true"],
                    url: ["true"],
                    threadCounts: ["true"],
                    idleTime: ["true"],
                    connectTime: ["true"]
                }]
            }],
            stringProp: [
                { $: { name: "filename" }, _: "" }
            ]
        };

        this.addChildElement('ResultCollector', listener);
    }

    addTimer(delayMs: number, randomDelayMs: number = 0): void {
        if (randomDelayMs > 0) {
            const timer = {
                $: {
                    guiclass: "UniformRandomTimerGui",
                    testclass: "UniformRandomTimer",
                    testname: "Uniform Random Timer",
                    enabled: "true"
                },
                stringProp: [
                    { $: { name: "ConstantTimer.delay" }, _: String(delayMs) },
                    { $: { name: "RandomTimer.range" }, _: String(randomDelayMs) }
                ]
            };
            this.addChildElement('UniformRandomTimer', timer);
        } else {
            const timer = {
                $: {
                    guiclass: "ConstantTimerGui",
                    testclass: "ConstantTimer",
                    testname: "Constant Timer",
                    enabled: "true"
                },
                stringProp: [
                    { $: { name: "ConstantTimer.delay" }, _: String(delayMs) }
                ]
            };
            this.addChildElement('ConstantTimer', timer);
        }
    }

    addAssertion(testField: string, pattern: string, isRegex: boolean = false): void {
        const fieldMap: Record<string, string> = {
            'response_data': 'Assertion.response_data',
            'response_code': 'Assertion.response_code',
            'response_headers': 'Assertion.response_headers'
        };

        const testFieldValue = fieldMap[testField] || 'Assertion.response_data';
        const testType = isRegex ? "1" : "2";

        const assertion = {
            $: {
                guiclass: "AssertionGui",
                testclass: "ResponseAssertion",
                testname: "Response Assertion",
                enabled: "true"
            },
            collectionProp: [{
                $: { name: "Asserion.test_strings" },
                stringProp: [
                    { $: { name: "0" }, _: pattern }
                ]
            }],
            stringProp: [
                { $: { name: "Assertion.custom_message" }, _: "" },
                { $: { name: "Assertion.test_field" }, _: testFieldValue },
                { $: { name: "Assertion.assume_success" }, _: "false" },
                { $: { name: "Assertion.test_type" }, _: testType }
            ]
        };

        this.addChildElement('ResponseAssertion', assertion);
    }

    async save(filepath: string) {
        await fs.writeFile('debug.json', JSON.stringify(this.jmxStructure, null, 2));
        const xml = this.xmlBuilder.buildObject(this.jmxStructure);
        await fs.writeFile(filepath, xml);
    }
}
