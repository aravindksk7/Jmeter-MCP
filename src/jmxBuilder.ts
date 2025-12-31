
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
     * Gets the single hashTree object that is sibling to TestPlan.
     * This is where ThreadGroups and their hashTrees go.
     * Structure: jmeterTestPlan.hashTree[0].hashTree[0] = { ThreadGroup: [...], hashTree: [...] }
     */
    private getTestPlanChildHashTree(): any {
        const rootHashTree = this.jmxStructure.jmeterTestPlan.hashTree[0];
        
        // Ensure hashTree array exists
        if (!rootHashTree.hashTree) {
            rootHashTree.hashTree = [{}];
        }
        
        // Ensure it's an array
        if (!Array.isArray(rootHashTree.hashTree)) {
            rootHashTree.hashTree = [rootHashTree.hashTree];
        }
        
        // Ensure first item is an object (not empty string)
        if (!rootHashTree.hashTree[0] || typeof rootHashTree.hashTree[0] === 'string') {
            rootHashTree.hashTree[0] = {};
        }
        
        return rootHashTree.hashTree[0];
    }

    /**
     * Gets the single hashTree object that holds children of the ThreadGroup.
     * Structure: testPlanHashTree.hashTree[0] = { HTTPSamplerProxy: [...], hashTree: [...] }
     */
    private getThreadGroupChildContainer(): any | null {
        const testPlanHashTree = this.getTestPlanChildHashTree();
        
        // Check if ThreadGroup exists
        if (!testPlanHashTree.ThreadGroup) {
            return null;
        }
        
        // Ensure hashTree array exists for ThreadGroup's children
        if (!testPlanHashTree.hashTree) {
            testPlanHashTree.hashTree = [{}];
        }
        
        // Ensure it's an array
        if (!Array.isArray(testPlanHashTree.hashTree)) {
            testPlanHashTree.hashTree = [testPlanHashTree.hashTree];
        }
        
        // Ensure first item is an object
        if (!testPlanHashTree.hashTree[0] || typeof testPlanHashTree.hashTree[0] === 'string') {
            testPlanHashTree.hashTree[0] = {};
        }
        
        return testPlanHashTree.hashTree[0];
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
        
        // Add ThreadGroup to the testPlanHashTree object
        testPlanHashTree.ThreadGroup = [threadGroup];
        
        // Initialize hashTree for ThreadGroup's children (will contain child elements)
        testPlanHashTree.hashTree = [{}];
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
        
        // Add empty hashTree entry for this element's children
        if (!container.hashTree) {
            container.hashTree = [''];
        } else if (Array.isArray(container.hashTree)) {
            container.hashTree.push('');
        }
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

    /**
     * Build XML with proper element/hashTree interleaving.
     * JMeter requires: Element1, hashTree1, Element2, hashTree2, ...
     */
    private buildInterleavedXml(container: any, indent: string = ''): string {
        let xml = '';
        const childIndent = indent + '  ';
        
        // Collect all element types except 'hashTree' and '$'
        const elementTypes = Object.keys(container).filter(k => k !== 'hashTree' && k !== '$');
        const hashTrees = container.hashTree || [];
        
        // Build interleaved output
        let hashTreeIndex = 0;
        for (const elementType of elementTypes) {
            const elements = container[elementType];
            if (Array.isArray(elements)) {
                for (const element of elements) {
                    // Build element XML
                    xml += this.buildElementXml(elementType, element, childIndent);
                    
                    // Add corresponding hashTree
                    if (hashTreeIndex < hashTrees.length) {
                        const ht = hashTrees[hashTreeIndex];
                        if (ht && typeof ht === 'object' && Object.keys(ht).length > 0) {
                            xml += `${childIndent}<hashTree>\n`;
                            xml += this.buildInterleavedXml(ht, childIndent);
                            xml += `${childIndent}</hashTree>\n`;
                        } else {
                            xml += `${childIndent}<hashTree/>\n`;
                        }
                        hashTreeIndex++;
                    } else {
                        xml += `${childIndent}<hashTree/>\n`;
                    }
                }
            }
        }
        
        return xml;
    }

    /**
     * Build XML for a single element with its attributes and children.
     */
    private buildElementXml(tagName: string, element: any, indent: string): string {
        // Handle primitive values (strings, numbers, booleans)
        if (element === null || element === undefined) {
            return `${indent}<${tagName}/>\n`;
        }
        
        if (typeof element !== 'object') {
            // Element is a primitive value - wrap it directly
            const value = String(element);
            if (value === '') {
                return `${indent}<${tagName}/>\n`;
            }
            return `${indent}<${tagName}>${this.escapeXml(value)}</${tagName}>\n`;
        }
        
        let xml = `${indent}<${tagName}`;
        
        // Add attributes
        if (element.$) {
            for (const [attr, value] of Object.entries(element.$)) {
                xml += ` ${attr}="${this.escapeXml(String(value))}"`;
            }
        }
        
        // Check for child elements
        const childKeys = Object.keys(element).filter(k => k !== '$' && k !== '_');
        const hasText = element._ !== undefined;
        
        if (childKeys.length === 0 && !hasText) {
            xml += '/>\n';
        } else {
            xml += '>';
            
            if (hasText && childKeys.length === 0) {
                xml += this.escapeXml(String(element._));
                xml += `</${tagName}>\n`;
            } else {
                xml += '\n';
                
                // Build child elements
                for (const childKey of childKeys) {
                    const children = element[childKey];
                    if (Array.isArray(children)) {
                        for (const child of children) {
                            xml += this.buildElementXml(childKey, child, indent + '  ');
                        }
                    }
                }
                
                xml += `${indent}</${tagName}>\n`;
            }
        }
        
        return xml;
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    async save(filepath: string) {
        await fs.writeFile('debug.json', JSON.stringify(this.jmxStructure, null, 2));
        
        // Build XML with proper interleaving
        const root = this.jmxStructure.jmeterTestPlan;
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.5">\n';
        xml += '  <hashTree>\n';
        
        // Build TestPlan element
        const testPlan = root.hashTree[0].TestPlan[0];
        xml += this.buildElementXml('TestPlan', testPlan, '    ');
        
        // Build TestPlan's hashTree (contains ThreadGroup and its children)
        const testPlanHashTree = root.hashTree[0].hashTree?.[0];
        if (testPlanHashTree && typeof testPlanHashTree === 'object' && Object.keys(testPlanHashTree).length > 0) {
            xml += '    <hashTree>\n';
            
            // Build ThreadGroup
            if (testPlanHashTree.ThreadGroup) {
                const threadGroup = testPlanHashTree.ThreadGroup[0];
                xml += this.buildElementXml('ThreadGroup', threadGroup, '      ');
                
                // Build ThreadGroup's children hashTree
                const threadGroupHashTree = testPlanHashTree.hashTree?.[0];
                if (threadGroupHashTree && typeof threadGroupHashTree === 'object' && Object.keys(threadGroupHashTree).length > 0) {
                    xml += '      <hashTree>\n';
                    xml += this.buildInterleavedXml(threadGroupHashTree, '      ');
                    xml += '      </hashTree>\n';
                } else {
                    xml += '      <hashTree/>\n';
                }
            }
            
            xml += '    </hashTree>\n';
        } else {
            xml += '    <hashTree/>\n';
        }
        
        xml += '  </hashTree>\n';
        xml += '</jmeterTestPlan>\n';
        
        await fs.writeFile(filepath, xml);
    }
}

