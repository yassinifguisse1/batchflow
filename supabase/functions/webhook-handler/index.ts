import "https://deno.land/x/xhr@0.1.0/mod.ts";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import type { SupabaseClient as SupabaseClientGeneric } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Add Deno type declaration for TypeScript
interface DenoEnv {
  get(key: string): string | undefined;
}

declare const Deno: {
  env: DenoEnv;
};

// Type for Supabase client
type SupabaseClientType = SupabaseClientGeneric<any, 'public', any>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-make-apikey',
};

const NUMBERED_FIELD_PATTERN = /^(prompt|image_size|keyword|seo)\d*$/;

function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  try {
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractNumberedFields(source: unknown): Record<string, unknown> {
  if (!isRecord(source)) {
    return {};
  }

  const entries: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (NUMBERED_FIELD_PATTERN.test(key)) {
      entries[key] = value;
    }
  }

  return entries;
}

function extractNodeResults(execution: unknown): Record<string, unknown> {
  if (!isRecord(execution)) {
    return {};
  }

  const resultData = execution.result_data;
  if (!isRecord(resultData)) {
    return {};
  }

  const { nodeResults } = resultData;
  return isRecord(nodeResults) ? nodeResults : {};
}

interface WebhookData {
  id: string;
  name: string;
  url_path: string;
  user_id: string;
  api_keys: Array<{
    id: string;
    name: string;
    key: string;
    header: string;
  }>;
  workflow_data: WorkflowData;
  status: string;
}

interface WorkflowData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowResult {
  message: string;
  data: Record<string, unknown>;
  error?: string | null;
  status?: string;
  hasWebhookResponse?: boolean;
  webhookResponse?: {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    error?: string;
  } | null;
  executedNodes?: string[];
  nodeCount?: number;
  executionId?: string | null;
  httpTaskCount?: number;
  gptTaskCount?: number;
  totalParallelTasks?: number;
  parallelOptimized?: boolean;
  details?: {
    reason: string;
    suggestion?: string;
    timestamp: string;
  };
}

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    config?: Record<string, unknown> | unknown;
    label?: string;
    nodeNumber?: number;
    createdAt?: string;
    [key: string]: unknown;
  };
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

serve(async (req) => {
  console.log('🚀 Webhook handler called!');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract webhook path from URL
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const webhookPath = pathSegments[pathSegments.length - 1]; // Get the last segment as webhook path

    console.log(`Processing webhook request for path: ${webhookPath}`);

    // Get request body and headers
    let requestBody: Record<string, unknown> = {};
    console.log('🔍 Content-Type header:', req.headers.get('content-type'));
    console.log('🔍 Request method:', req.method);
    
    try {
      const contentType = req.headers.get('content-type') || '';
      const requestText = await req.text();
      console.log('🔍 Raw request body:', requestText.substring(0, 500) + (requestText.length > 500 ? '...' : ''));
      
      // Parse body by content-type
      if (contentType.includes('application/json')) {
        if (requestText.trim()) {
          try {
            requestBody = JSON.parse(requestText);
            console.log('✅ Parsed JSON body:', JSON.stringify(requestBody, null, 2));
            console.log('✅ JSON body keys:', Object.keys(requestBody));
          } catch (jsonError) {
            console.log('❌ JSON parsing failed:', jsonError);
            console.log('❌ Invalid JSON content:', requestText);
            // Try to extract valid JSON if possible
            try {
              // Clean up common JSON issues
              const cleanedText = requestText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
              requestBody = JSON.parse(cleanedText);
              console.log('✅ Parsed cleaned JSON body:', JSON.stringify(requestBody, null, 2));
            } catch (secondError) {
              console.log('❌ Even cleaned JSON parsing failed:', secondError);
              requestBody = { raw_body: requestText };
            }
          }
        } else {
          requestBody = {};
        }
      } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
      ) {
        // Handle both URL-encoded and multipart form data
        const formData = await req.formData();
        const entries: Record<string, unknown> = {};
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            // Serialize files into JSON-safe descriptors
            entries[key] = {
              filename: value.name,
              type: value.type,
              size: value.size,
            };
          } else {
            entries[key] = value;
          }
        }
        requestBody = entries;
      } else if (contentType.includes('text/')) {
        requestBody = { body: await req.text() };
      } else {
        // Try to parse as JSON, fallback to text
        if (requestText.trim()) {
          try {
            requestBody = JSON.parse(requestText);
          } catch {
            requestBody = { body: requestText };
          }
        } else {
          requestBody = {};
        }
      }
    } catch (error) {
      console.log('Error parsing request body:', error);
      requestBody = {};
    }

    // Always capture query string parameters as part of the request payload
    const queryParams = Object.fromEntries(new URL(req.url).searchParams.entries());
    if (Object.keys(queryParams).length > 0) {
      // Merge with body; body values take precedence over query parameters
      const isObj = requestBody && typeof requestBody === 'object' && !Array.isArray(requestBody);
      requestBody = {
        ...queryParams,
        ...(isObj ? requestBody : { body: requestBody })
      };
    }

    const requestHeaders = Object.fromEntries(req.headers.entries());

    console.log('🎯 Final request body (merged with query params if any):', JSON.stringify(requestBody, null, 2));
    console.log('🎯 Final request body keys:', Object.keys(requestBody));
    console.log('🎯 Request headers:', Object.keys(requestHeaders));
    
    // Specifically check for numbered prompt and image_size fields
    const numberedFields = Object.keys(requestBody).filter(key => 
      key.match(/^(prompt|image_size)\d+$/)
    );
    console.log('🎯 Found numbered fields:', numberedFields);
    console.log('🎯 Numbered field values:', numberedFields.map(field => ({
      field,
      value: requestBody[field]
    })));

    // Find webhook configuration
    const { data: webhook, error: webhookError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('url_path', webhookPath)
      .eq('status', 'active')
      .single();

    if (webhookError || !webhook) {
      console.error('Webhook not found:', webhookError);
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found webhook:', webhook.name);

    // Validate API key if required
    if (webhook.api_keys && webhook.api_keys.length > 0) {
      let isAuthorized = false;
      
      for (const apiKeyConfig of webhook.api_keys) {
        const headerValue = requestHeaders[apiKeyConfig.header.toLowerCase()];
        if (headerValue === apiKeyConfig.key) {
          isAuthorized = true;
          break;
        }
      }

      if (!isAuthorized) {
        console.error('Unauthorized: Invalid API key');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Find and execute workflow automatically
    let workflowResult: WorkflowResult = { message: 'Webhook received successfully', data: requestBody, error: null };
    
    // Look for all workflows that use this webhook
    const { data: workflows, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', webhook.user_id)
      .eq('status', 'active');

    console.log(`Found ${workflows?.length || 0} active workflows for user`);

    if (!workflowError && workflows && workflows.length > 0) {
      // Find a workflow that has a trigger node using our webhook
      let matchingWorkflow = null;
      let triggerNode = null;
      
      for (const workflow of workflows) {
        if (workflow.workflow_data && workflow.workflow_data.nodes) {
          const foundTrigger = (workflow as any).workflow_data.nodes.find((node: WorkflowNode) => 
            node.type === 'trigger' && 
            (node.data.config as any)?.selectedHook === webhook.id
          );
          
          if (foundTrigger) {
            matchingWorkflow = workflow;
            triggerNode = foundTrigger;
            break;
          }
        }
      }
      
      if (matchingWorkflow && triggerNode) {
        console.log(`Found matching workflow: ${(matchingWorkflow as any).name} with trigger using webhook ${webhook.id}`);
        console.log(`Automatically executing workflow: ${(matchingWorkflow as any).name}`);
        
        try {
          // Create webhook request first to get ID for execution tracking
          const initialProcessingTime = Date.now() - startTime;
          const { data: webhookRequestRecord, error: webhookRequestError } = await supabase
            .from('webhook_requests')
            .insert({
              webhook_id: webhook.id,
              request_body: requestBody,
              request_headers: requestHeaders,
              response_body: { message: 'Processing...', input: requestBody, originalRequest: requestBody },
              response_status: 200,
              processing_time_ms: initialProcessingTime
            })
            .select()
            .single();

          const webhookRequestId = webhookRequestRecord?.id || null;
          console.log('✅ Created webhook request record:', webhookRequestId);
          console.log('🎯 About to process workflow with inputData:', JSON.stringify(requestBody, null, 2));
          console.log('🎯 InputData keys:', Object.keys(requestBody));
          
          // Ensure the trigger data includes the original webhook request for proper display
          // Also expose all request body fields directly for easy parameter access
          const enrichedTriggerData = {
            ...requestBody, // Include all webhook request fields directly
            originalRequest: requestBody,
            webhookHeaders: requestHeaders,
            webhookId: webhook.id,
            webhookName: webhook.name,
            // Expose common webhook fields for easy access
            body: requestBody,
            webhookData: {
              id: webhook.id,
              name: webhook.name,
              request_body: requestBody,
              request_headers: requestHeaders
            }
          };

          // Process workflow with early webhook response capability
          workflowResult = await processWorkflowWithEarlyResponse(
            (matchingWorkflow as any).workflow_data, 
            enrichedTriggerData, 
            supabase,
            webhookRequestId,
            (matchingWorkflow as any).id,
            webhook.user_id
          );

          // Update webhook request with final result
          if (webhookRequestId) {
            const enrichedResult = {
              ...workflowResult,
              input: requestBody,
              originalRequest: requestBody,
              webhookData: {
                id: webhook.id,
                name: webhook.name,
                request_body: requestBody,
                request_headers: requestHeaders
              }
            };
            await supabase
              .from('webhook_requests')
              .update({
                response_body: enrichedResult,
                processing_time_ms: Date.now() - startTime
              })
              .eq('id', webhookRequestId);
          }
        } catch (workflowError) {
          const err = ensureError(workflowError);
          
          console.log('\n' + '='.repeat(80));
          console.log('🚨 WEBHOOK WORKFLOW EXECUTION FAILED');
          console.log('='.repeat(80));
          console.log(`❌ Error: ${err.message}`);
          
          // Determine if this is an incomplete results error
          const isIncompleteResults = err.message.includes('Incomplete workflow results') || 
                                    err.message.includes('Missing GPT') ||
                                    err.message.includes('Cannot send partial response');
          
          if (isIncompleteResults) {
            console.log(`🔍 Error Type: Incomplete Results`);
            console.log(`📝 Reason: Not all GPT tasks completed successfully`);
            console.log(`🎯 Action: Returning error response to Make.com (no partial data)`);
            console.log(`💡 Suggestion: Check GPT task configurations and retry`);
            
          workflowResult = { 
              error: 'Workflow incomplete',
              message: 'Not all required GPT results were generated. Workflow blocked to prevent partial data.',
              details: {
                reason: 'incomplete_gpt_results',
                suggestion: 'Check GPT task configurations and retry the webhook',
                timestamp: new Date().toISOString()
              },
              data: requestBody
            };
          } else {
            console.log(`🔍 Error Type: System Error`);
            console.log(`📝 Reason: ${err.message}`);
            console.log(`🎯 Action: Returning generic error response`);
            
            workflowResult = { 
              error: 'Workflow execution failed',
              message: err.message,
              details: {
                reason: 'system_error',
                timestamp: new Date().toISOString()
              },
            data: requestBody 
          };
          }
          
          console.log('='.repeat(80));
        }
      } else {
        console.log(`No matching trigger node found for webhook ${webhook.id} in any of the ${workflows.length} workflows`);
        // Log all trigger configurations for debugging
        workflows.forEach((wf, idx) => {
          if (wf.workflow_data?.nodes) {
            const triggers = wf.workflow_data.nodes.filter((n: WorkflowNode) => n.type === 'trigger');
            console.log(`Workflow ${idx} (${wf.name}) triggers:`, triggers.map((t: WorkflowNode) => {
              const config = isRecord(t.data?.config) ? t.data?.config : {};
              return {
                selectedHook: config.selectedHook,
                triggerType: config.triggerType
              };
            }));
          }
        });
      }
    } else {
      console.log('No active workflows found for this webhook or error occurred:', workflowError);
    }

    // Skip duplicate webhook request logging since it was already done during workflow execution

    const finalProcessingTime = Date.now() - startTime;
    console.log(`Webhook processed successfully in ${finalProcessingTime}ms`);

    // Return custom response if workflow has webhook response node
    if ((workflowResult as any)?.hasWebhookResponse && (workflowResult as any).webhookResponse) {
      const webhookResponse = (workflowResult as any).webhookResponse;
      
      // Handle error responses in webhook response
      if (webhookResponse.error) {
        console.log(`❌ Webhook response error: ${webhookResponse.error}`);
        return new Response(
          JSON.stringify({ error: webhookResponse.error }),
          { 
            status: webhookResponse.statusCode || 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...webhookResponse.headers
      };

      // Build a guaranteed valid JSON response
      let responseBody: string;
      const orig = webhookResponse.body;
      if (typeof orig === 'string') {
        const trimmed = orig.trim();
        const looksJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
        if (looksJson) {
          try {
            const parsed = JSON.parse(trimmed);
            responseBody = JSON.stringify(parsed);
          } catch (e) {
            console.log('Invalid JSON string in webhook response; wrapping as JSON object');
            responseBody = JSON.stringify({ result: orig });
          }
        } else {
          responseBody = JSON.stringify({ result: orig });
        }
      } else {
        responseBody = JSON.stringify(orig);
      }

      return new Response(
        responseBody,
        { 
          status: webhookResponse.statusCode || 200, 
          headers: responseHeaders
        }
      );
    }

    // Default response - return the actual workflow result
    // If we have workflow execution data, return it, otherwise return the original request data
    const responseData = workflowResult?.data ? workflowResult : { message: 'Webhook received successfully', data: requestBody };
    
    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    const processingTime = Date.now() - startTime;
    const err = ensureError(error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: err.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Global parameter replacement function
function replaceParameters(template: unknown, workflowData: Record<string, unknown>): unknown {
  if (!template) return template;
  
  // If it's not a string, recursively process objects/arrays
  if (typeof template === 'object' && template !== null) {
    if (Array.isArray(template)) {
      return template.map(item => replaceParameters(item, workflowData));
    } else {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = replaceParameters(value, workflowData);
      }
      return result;
    }
  }
  
  // Only process strings
  if (typeof template !== 'string') {
    return template;
  }
  
  // Replace parameters in the string
  const replaced = template.replace(/\{\{([^}]+)\}\}/g, (match, expr, offset, full) => {
    console.log(`🔍 Replacing parameter: ${match}`);
    console.log(`🔍 Available keys: ${Object.keys(workflowData).join(', ')}`);

    // Detect if the placeholder is wrapped in JSON quotes in the template
    const prevChar = typeof offset === 'number' && offset > 0 ? (full as string)[offset - 1] : '';
    const nextChar = typeof offset === 'number' ? (full as string)[offset + match.length] : '';
    const inJsonQuotes = prevChar === '"' && nextChar === '"';

    // Serialize a value safely for JSON templates
    const serializeForContext = (val: unknown) => {
      // When placeholder is inside quotes → escape the content but don't add extra quotes
      if (inJsonQuotes) {
        if (val === null || val === undefined) return '';
        const asString = typeof val === 'string' ? val : String(val);
        // JSON.stringify gives us proper escapes; strip surrounding quotes
        return JSON.stringify(asString).slice(1, -1);
      }
      // Outside quotes → emit valid JSON
      if (typeof val === 'string') return JSON.stringify(val);
      if (typeof val === 'object') return JSON.stringify(val);
      if (val === null || val === undefined) return 'null';
      return String(val);
    };

    try {
      const trimmedExpr = (expr as string).trim();

      // First, try direct key access for exact matches (including spaces)
      if (Object.prototype.hasOwnProperty.call(workflowData, trimmedExpr)) {
        const value = workflowData[trimmedExpr];
        const out = serializeForContext(value);
        console.log(`✅ Direct match - Replaced ${match} with: ${out.substring(0, 100)}`);
        return out;
      }
      
      // Handle field access within trigger data (e.g., "Trigger 3.image_size1") 
      const triggerMatch = trimmedExpr.match(/^Trigger\s+\d+\.(.+)$/);
      if (triggerMatch) {
        const fieldName = triggerMatch[1];
        console.log(`🔍 Matched key: "Trigger ${triggerMatch[0].match(/\d+/)?.[0]}", remaining path: "${fieldName}"`);
        
        // First, check if the field exists directly in the root of workflowData (webhook request body)
        if (Object.prototype.hasOwnProperty.call(workflowData, fieldName)) {
          const value = workflowData[fieldName];
          const out = serializeForContext(value);
          console.log(`✅ Found field "${fieldName}" directly in webhook data - Replaced ${match} with: ${out.substring(0, 100)}`);
          return out;
        }
        
        // Also check in the original request body
        const originalRequest = isRecord(workflowData.originalRequest) ? workflowData.originalRequest : null;
        if (originalRequest && Object.prototype.hasOwnProperty.call(originalRequest, fieldName)) {
          const value = originalRequest[fieldName];
          const out = serializeForContext(value);
          console.log(`✅ Found field "${fieldName}" in originalRequest - Replaced ${match} with: ${out.substring(0, 100)}`);
          return out;
        }
        
        // Try to find the field in any Trigger object
        const sortedTriggerKeys = Object.keys(workflowData)
          .filter(key => key.startsWith('Trigger '))
          .sort((a, b) => {
            // Prioritize exact numeric matches
            const aNum = a.match(/\d+/)?.[0];
            const bNum = b.match(/\d+/)?.[0];
            if (aNum && bNum) return parseInt(aNum) - parseInt(bNum);
            return a.localeCompare(b);
          });
        
        console.log(`🔍 Sorted keys for "${trimmedExpr}":`, sortedTriggerKeys);
        console.log(`🔍 Available keys:`, Object.keys(workflowData).join(', '));
        
        for (const key of sortedTriggerKeys) {
          const triggerData = workflowData[key];
          if (isRecord(triggerData)) {
            console.log(`🔍 Property access match: "${key}" -> "${fieldName}"`);
            console.log(`❌ Available in current object:`, Object.keys(triggerData));
            
            if (fieldName in triggerData) {
              const value = triggerData[fieldName];
              const out = serializeForContext(value);
              console.log(`✅ Found in ${key}.${fieldName} - Replaced ${match} with: ${out.substring(0, 100)}`);
              return out;
            }
          }
        }
        
        // If not found in Trigger objects, check if field exists in original trigger data
        console.log(`❌ Trigger field not found: ${fieldName} in any Trigger object`);
        console.log(`❌ Available trigger fields:`, Object.keys(workflowData).filter(k => k.startsWith('Trigger') || k === 'originalTriggerData' || k === 'trigger' || k === 'data' || k === 'webhookRequestBody' || k === 'originalRequest' || k === 'webhookHeaders' || k === 'webhookId' || k === 'webhookName' || k === 'body' || k === 'webhookData'));
        console.log(`❌ Available fields in root workflowData:`, Object.keys(workflowData));
        
        return inJsonQuotes ? '' : '""'; // Return safe value for missing fields
      }

      // Handle nested property access like "GPT 1.result" or "Trigger 1.body"
      let value: unknown = workflowData;
      let currentPath = trimmedExpr;
      
      // Sort keys prioritizing exact numeric matches first, then by length
      const sortedKeys = Object.keys(workflowData).sort((a, b) => {
        // For expressions like "GPT 2.result", prioritize "GPT 2" over "GPT"
        const aHasNumber = /\d/.test(a);
        const bHasNumber = /\d/.test(b);
        
        // If one has a number and the other doesn't, prioritize the one with a number
        if (aHasNumber && !bHasNumber) return -1;
        if (!aHasNumber && bHasNumber) return 1;
        
        // Both have numbers or both don't, sort by length (longest first)
        return b.length - a.length;
      });
      
      console.log(`🔍 Sorted keys for "${trimmedExpr}":`, sortedKeys.slice(0, 10));
      
      // Try to find the best matching key
      let matchedKey: string | null = null;
      for (const key of sortedKeys) {
        if (currentPath === key) {
          // Exact match
          value = workflowData[key];
          currentPath = '';
          matchedKey = key;
          console.log(`🔍 Exact match found: "${key}"`);
          break;
        } else if (currentPath.startsWith(key + '.')) {
          // Key with property access - ensure exact boundary match
          const afterKey = currentPath.substring(key.length);
          if (afterKey.startsWith('.')) {
            value = workflowData[key];
            currentPath = afterKey.substring(1); // Remove the dot
            matchedKey = key;
            console.log(`🔍 Property access match: "${key}" -> "${currentPath}"`);
            break;
          }
        }
      }
      
      console.log(`🔍 Matched key: "${matchedKey}", remaining path: "${currentPath}"`);
      
      // If no exact match found, try fuzzy matching for GPT nodes
      if (!matchedKey && trimmedExpr.includes('.')) {
        const [nodePrefix, property] = trimmedExpr.split('.', 2);
        
        // For GPT references like "GPT 1.result", "GPT 4.result", etc.
        if (typeof nodePrefix === 'string' && nodePrefix.toLowerCase().includes('gpt')) {
          console.log(`🔍 Looking for GPT node matching "${nodePrefix}" with property "${property}"`);

          const requestedNumMatch = nodePrefix.match(/(\d+)$/);
          const requestedNum = requestedNumMatch ? Number(requestedNumMatch[1]) : null;
          // All GPT-related keys that expose the requested property
          const gptKeys = sortedKeys.filter((key) => {
            const keyLower = key.toLowerCase();
            const isGptKey = keyLower.includes('gpt');
            if (!isGptKey) return false;
            const candidate = workflowData[key];
            const hasProp = isRecord(candidate) && property in candidate;
            return hasProp;
          });

          console.log(`🔍 Found GPT keys with property "${property}": [${gptKeys.join(', ')}]`);

          if (gptKeys.length > 0) {
            let candidate: string | undefined;
            if (requestedNum !== null) {
              console.log(`🔍 Looking for specific GPT number: ${requestedNum}`);
              console.log(`🔍 Available GPT keys: ${gptKeys.join(', ')}`);
              
              // EXACT matching first - prefer specific numbered keys over generic ones
              // Try exact "GPT <n>" first
              candidate = gptKeys.find((k) => {
                const keyLower = k.toLowerCase();
                return keyLower === `gpt ${requestedNum}` || keyLower === `gpt${requestedNum}`;
              });
              console.log(`🔍 Exact "gpt ${requestedNum}" match:`, candidate);
              
              // Then try "GPT Task <n>"  
              if (!candidate) {
                candidate = gptKeys.find((k) => {
                  const keyLower = k.toLowerCase();
                  return keyLower === `gpt task ${requestedNum}` || keyLower === `gpttask${requestedNum}`;
                });
                console.log(`🔍 Exact "gpt task ${requestedNum}" match:`, candidate);
              }
              
              // Then try node-specific keys that contain the exact number with word boundaries
              if (!candidate) {
                candidate = gptKeys.find((k) => {
                  // Use word boundary regex to ensure exact number match
                  const regex = new RegExp(`\\b${requestedNum}\\b`);
                  return regex.test(k);
                });
                console.log(`🔍 Word boundary match for ${requestedNum}:`, candidate);
              }
              
              // Finally, try to map by numeric suffix in the key (only if no exact match found)
              if (!candidate) {
                // Sort gptKeys by how well they match the requested number
                const withNums = gptKeys
                  .map((k) => {
                    const nums = k.match(/\d+/g);
                    if (!nums) return { k, num: null, score: -1 };
                    
                    // If multiple numbers, prefer the one that matches exactly
                    for (const numStr of nums) {
                      const num = parseInt(numStr);
                      if (num === requestedNum) {
                        return { k, num, score: 10 }; // Highest priority for exact match
                      }
                    }
                    
                    // If no exact match, use the first number with lower priority
                    return { k, num: parseInt(nums[0]), score: 1 };
                  })
                  .filter((x) => x.num !== null)
                  .sort((a, b) => b.score - a.score); // Sort by score descending
                
                candidate = withNums.find((x) => x.num === requestedNum)?.k;
                console.log(`🔍 Numeric suffix match for ${requestedNum}:`, candidate, 'from options:', withNums);
              }
            }

            // Only use fallback if no specific match was found AND requestedNum is null
            if (!candidate && requestedNum === null) {
              candidate = gptKeys[0];
              console.log(`🔍 Fallback match (no number specified):`, candidate);
            }
            
            if (candidate) {
              matchedKey = candidate;
              value = workflowData[matchedKey];
              currentPath = property;
              console.log(`🔍 Final matched GPT key: "${matchedKey}" for "${nodePrefix}" with value:`, typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value);
            } else {
              console.log(`❌ No suitable GPT key found for "${nodePrefix}"`);
            }
          }
        }
      }
      
      // If we have a remaining path, traverse it
      if (currentPath && currentPath.length > 0) {
        const parts = currentPath.split('.');
        for (const part of parts) {
          if (isRecord(value) && part in value) {
            value = value[part];
            const preview = typeof value === 'string' ? (value as string).substring(0, 100) : value;
            console.log(`🔍 Found nested property "${part}":`, preview);
          } else {
            console.log(`❌ Path not found: ${trimmedExpr} (missing: ${part})`);
            const availableKeys = isRecord(value) ? Object.keys(value) : 'not an object';
            console.log('❌ Available in current object:', availableKeys);
            return inJsonQuotes ? '' : '""'; // Return safe value for missing fields
          }
        }
      }
      
      // Special handling for HTTP response objects when accessing "response" property
      if (trimmedExpr.endsWith('.response') && value && typeof value === 'object') {
        console.log(`🔍 Processing HTTP response object for: ${trimmedExpr}`);
        
        // Try to extract the actual response content, not the wrapper object
        if ('http_response' in value && value.http_response && typeof value.http_response === 'object') {
          if ('body' in value.http_response) {
            value = value.http_response.body;
            console.log(`🔍 Extracted HTTP response body:`, value);
          } else {
            value = value.http_response;
            console.log(`🔍 Using HTTP response object:`, value);
          }
        } else if ('body' in value && typeof value.body !== 'undefined') {
          value = value.body;
          console.log(`🔍 Extracted body from response:`, value);
        } else if ('response' in value && value.response && typeof value.response === 'object') {
          if ('body' in value.response) {
            value = value.response.body;
            console.log(`🔍 Extracted nested response body:`, value);
          } else {
            value = value.response;
            console.log(`🔍 Using nested response:`, value);
          }
        }
        // If it's an error response with EntityID, keep the error message for debugging
        else if ('EntityID' in value && 'Message' in value) {
          console.log(`🔍 Found error response object:`, value);
          // For error responses, return the error message instead of [object Object]
          value = value.Message || 'HTTP request failed';
        }
      }
      
      const out = serializeForContext(value);
      console.log(`✅ Replaced ${match} with: ${out.substring(0, 100)}${out.length > 100 ? '...' : ''}`);
      return out;
    } catch (error) {
      console.log(`❌ Error replacing ${match}:`, error);
      // Return empty string for missing fields to avoid JSON syntax errors
      return inJsonQuotes ? '' : '""';
    }
  });
  
  return replaced;
}

// New function that waits for all parallel HTTP tasks before webhook response
async function processWorkflowWithEarlyResponse(
  workflowData: WorkflowData, 
  inputData: Record<string, unknown>, 
  supabase: SupabaseClientType, 
  webhookRequestId?: string, 
  workflowId?: string, 
  userId?: string
): Promise<WorkflowResult> {
  const { nodes, edges } = workflowData;
  
  // Check if workflow has webhook response node
  const webhookResponseNode = nodes.find((node: WorkflowNode) => node.type === 'webhookResponse');
  const hasWebhookResponseNode = !!webhookResponseNode;
  
  if (!hasWebhookResponseNode) {
    // No webhook response node, use regular processing
    return await processWorkflow(workflowData, inputData, supabase, webhookRequestId, workflowId, userId);
  }

  // Analyze workflow structure to find parallel HTTP and GPT tasks
  const parallelHttpGroups = findParallelHttpGroups(nodes, edges, webhookResponseNode.id);
  const parallelGptGroups = findParallelGptGroups(nodes, edges, webhookResponseNode.id);
  console.log('🔍 Found parallel HTTP groups:', parallelHttpGroups);
  console.log('🔍 Found parallel GPT groups:', parallelGptGroups);

  // If no parallel tasks at all, use regular processing
  if (parallelHttpGroups.length === 0 && parallelGptGroups.length === 0) {
    return await processWorkflow(workflowData, inputData, supabase, webhookRequestId, workflowId, userId);
  }

  // Process workflow with parallel HTTP optimization
  let webhookResponseResult: WorkflowResult['webhookResponse'] | null = null;
  let executionId: string | null = null;
  let accumulatedWorkflowData: Record<string, unknown> = {
    originalTriggerData: inputData,
    trigger: inputData,
    data: inputData,
    webhookRequestBody: inputData,
    ...inputData
  };

  // Add trigger data with multiple numbering options for compatibility
  for (let i = 1; i <= 10; i++) {
    accumulatedWorkflowData[`Trigger ${i}`] = {
      body: inputData,
      ...inputData
    };
  }

  try {
    // Create workflow execution record
    if (workflowId && userId && webhookRequestId) {
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          webhook_request_id: webhookRequestId,
          user_id: userId,
          status: 'running',
          executed_nodes: [],
          current_node_id: null
        })
        .select()
        .single();

      if (execution && !execError) {
        const executionIdentifier = typeof execution.id === 'string'
          ? execution.id
          : execution.id != null
            ? String(execution.id)
            : null;

        if (executionIdentifier) {
          executionId = executionIdentifier;
        }

        console.log('🚀 Created workflow execution record:', executionId);
      }
    }

    const executedNodes = new Set<string>();
    const nodeTypeCounts = new Map<string, number>();
    
    // Find trigger node and execute it first
    const triggerNode = nodes.find((node: WorkflowNode) => node.type === 'trigger');
    if (!triggerNode) {
      throw new Error('No trigger node found');
    }

    // Execute trigger node
    console.log('⚡ Executing trigger node');
    executedNodes.add(triggerNode.id);
    const triggerResult = await executeNode(triggerNode as WorkflowNode, accumulatedWorkflowData, supabase);
    if (triggerResult) {
      accumulatedWorkflowData = { ...accumulatedWorkflowData, ...triggerResult };
    }

    // Execute all parallel task groups (HTTP and GPT)
    const allParallelTasks: Promise<{
      nodeId: string;
      node: WorkflowNode;
      result: unknown;
      failed?: boolean;
      taskType: 'httpTask' | 'gptTask';
    } | null>[] = [];
    
    // Add HTTP tasks
    for (const httpGroup of parallelHttpGroups) {
      console.log(`🚀 Adding ${httpGroup.length} parallel HTTP tasks:`, httpGroup);
      
      for (const nodeId of httpGroup) {
        const task = executeParallelTask(nodeId, nodes, accumulatedWorkflowData, executedNodes, executionId, supabase, 'httpTask');
        allParallelTasks.push(task);
      }
    }
    
    // Add GPT tasks  
    for (const gptGroup of parallelGptGroups) {
      console.log(`🚀 Adding ${gptGroup.length} parallel GPT tasks:`, gptGroup);
      
      for (const nodeId of gptGroup) {
        const task = executeParallelTask(nodeId, nodes, accumulatedWorkflowData, executedNodes, executionId, supabase, 'gptTask');
        allParallelTasks.push(task);
      }
    }

    // Wait for ALL parallel tasks (HTTP + GPT) to complete with timeout protection
    console.log(`🚀 Waiting for ${allParallelTasks.length} parallel tasks to complete...`);
    
    // Add overall timeout for parallel execution (5 minutes)
    const PARALLEL_TIMEOUT = 300000; // 5 minutes
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Parallel tasks timed out after ${PARALLEL_TIMEOUT}ms`)), PARALLEL_TIMEOUT);
    });
    
    let allResults;
    try {
      allResults = await Promise.race([
        Promise.all(allParallelTasks),
        timeoutPromise
      ]);
      console.log(`✅ All ${allParallelTasks.length} parallel tasks completed successfully`);
    } catch (error) {
      const err = ensureError(error);
      if (err.message.includes('timed out')) {
        console.error(`⏰ Parallel tasks timed out after ${PARALLEL_TIMEOUT}ms`);
        // Mark execution as timed out but don't throw - return partial results
        if (executionId) {
          await supabase
            .from('workflow_executions')
            .update({
              status: 'timeout',
              error_message: err.message
            })
            .eq('id', executionId);
        }
        throw err;
      }
      throw err;
    }
    
    // Helper function to extract proper node number from GPT nodes
    const getGPTNodeNumber = (node: WorkflowNode): number => {
      const nodeLabel = (node.data?.label as string) || (node.data?.config as any)?.label || '';
      
      // First, try to extract from label (e.g., "GPT 3" -> 3)
      if (nodeLabel.trim()) {
        const labelMatch = nodeLabel.trim().match(/(\d+)/);
        if (labelMatch) {
          return parseInt(labelMatch[1]);
        }
      }
      
      // If no number from label, use nodeNumber from data
      if ((node as any).data?.nodeNumber) {
        return (node as any).data.nodeNumber as number;
      }
      
      // Try to extract from node ID as fallback
      const idMatch = node.id.match(/(\d+)/);
      if (idMatch) {
        return parseInt(idMatch[1]);
      }
      
      // Last fallback - find position in sorted GPT nodes
      const allGptNodes = nodes
        .filter((n: WorkflowNode) => n.type === 'gptTask')
        .sort((a: WorkflowNode, b: WorkflowNode) => {
          const aTime = (a.data as any)?.createdAt || a.id;
          const bTime = (b.data as any)?.createdAt || b.id;
          return aTime.localeCompare(bTime);
        });
      
      const gptIndex = allGptNodes.findIndex((n: WorkflowNode) => n.id === node.id);
      return gptIndex >= 0 ? gptIndex + 1 : 1;
    };

    // Process all results with proper node numbering
    const failedTasks: string[] = [];
    const successfulTasks: string[] = [];
    
    for (const taskResult of allResults) {
      if (!taskResult) continue;

      const { nodeId, node, result, failed, taskType } = taskResult;
      
      if (failed) {
        failedTasks.push(`${taskType} ${nodeId}`);
        console.error(`❌ ${taskType} task ${nodeId} failed, but continuing with other tasks`);
        
        // Don't stop execution, just log the failure
        if (executionId) {
          await supabase
            .from('workflow_executions')
            .update({
              error_details: {
                failed_node_id: nodeId,
                error_message: (result as any)?.error || `${taskType} task failed`
              }
            })
            .eq('id', executionId);
        }
        
        continue; // Continue with other tasks instead of throwing
      }

      successfulTasks.push(`${taskType} ${nodeId}`);

      // Store result with proper indexing based on actual node numbers
      if (result && typeof result === 'object') {
        const safeNodeResult = JSON.parse(JSON.stringify(result));
        const nodeLabel = (node.data?.label as string) || (node.data?.config as any)?.label || '';
        
        if (taskType === 'httpTask') {
          // For HTTP tasks, use sequential numbering (this is usually correct)
          const currentCount = nodeTypeCounts.get('httpTask') || 0;
          const nodeIndex = currentCount + 1;
          nodeTypeCounts.set('httpTask', nodeIndex);
          
          // Store with multiple reference patterns
          accumulatedWorkflowData[nodeId] = safeNodeResult;
          accumulatedWorkflowData[`HTTP ${nodeIndex}`] = safeNodeResult;
          accumulatedWorkflowData[`HTTP Task ${nodeIndex}`] = safeNodeResult;
          
          // Store under label if exists
          if (typeof nodeLabel === 'string' && nodeLabel.trim()) {
            accumulatedWorkflowData[nodeLabel.trim()] = safeNodeResult;
          }
          
          // Store first HTTP as default
          if (!accumulatedWorkflowData['HTTP']) {
            accumulatedWorkflowData['HTTP'] = safeNodeResult;
          }
          
          console.log(`💾 Stored HTTP result as "HTTP ${nodeIndex}"`);
        } else if (taskType === 'gptTask') {
          // For GPT tasks, use the ACTUAL node number from the workflow
          const actualNodeNumber = getGPTNodeNumber(node);
          
          console.log(`🔍 GPT Node ${nodeId} Debug:`, {
            nodeId,
            nodeLabel: nodeLabel.trim(),
            actualNodeNumber,
            dataKeys: Object.keys((node as any).data || {})
          });
          
          // Store with the CORRECT node number
          accumulatedWorkflowData[nodeId] = safeNodeResult;
          accumulatedWorkflowData[`GPT ${actualNodeNumber}`] = safeNodeResult;
          accumulatedWorkflowData[`GPT Task ${actualNodeNumber}`] = safeNodeResult;
          
          // Store under label if exists
          if (typeof nodeLabel === 'string' && nodeLabel.trim()) {
            accumulatedWorkflowData[nodeLabel.trim()] = safeNodeResult;
          }
          
          // Store first GPT as default
          if (!accumulatedWorkflowData['GPT']) {
            accumulatedWorkflowData['GPT'] = safeNodeResult;
          }
          
          // Update the count to track how many GPT tasks we've processed
          const currentCount = nodeTypeCounts.get('gptTask') || 0;
          nodeTypeCounts.set('gptTask', currentCount + 1);
          
          console.log(`💾 Stored GPT result as "GPT ${actualNodeNumber}" with result:`, 
            typeof (result as any).result === 'string' 
              ? (result as any).result.substring(0, 100) + '...'
              : (result as any).result
          );
        }
      }
    }

    // Log the results summary
    // Enhanced logging and validation before webhook response
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PARALLEL EXECUTION RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`📊 Task Execution Results:`);
    console.log(`   ✅ Successful tasks: ${successfulTasks.length}`);
    console.log(`   ❌ Failed tasks: ${failedTasks.length}`);
    console.log(`   📈 Success rate: ${Math.round((successfulTasks.length / allResults.length) * 100)}%`);
    
    if (successfulTasks.length > 0) {
      console.log(`\n✅ SUCCESSFUL TASKS:`);
      successfulTasks.forEach(task => console.log(`   ✓ ${task}`));
    }
    
    if (failedTasks.length > 0) {
      console.log(`\n❌ FAILED TASKS:`);
      failedTasks.forEach(task => console.log(`   ✗ ${task}`));
    }
    
    // Check if too many tasks failed
    if (failedTasks.length > 0) {
      const failureRate = failedTasks.length / allResults.length;
      if (failureRate > 0.5) { // More than 50% failed
        console.log(`\n🚨 CRITICAL FAILURE: Too many tasks failed (${Math.round(failureRate * 100)}%)`);
        throw new Error(`Too many parallel tasks failed (${failedTasks.length}/${allResults.length}): ${failedTasks.join(', ')}`);
      } else {
        console.log(`\n⚠️ WARNING: Some tasks failed but continuing (${Math.round(failureRate * 100)}% failure rate)`);
      }
    }

    // Detailed GPT results validation
    console.log(`\n🧠 GPT RESULTS VALIDATION:`);
    const expectedGPTCount = parallelGptGroups.reduce((total, group) => total + group.length, 0);
    const actualGPTCount = nodeTypeCounts.get('gptTask') || 0;
    
    console.log(`   Expected GPT tasks: ${expectedGPTCount}`);
    console.log(`   Completed GPT tasks: ${actualGPTCount}`);
    console.log(`   Missing GPT tasks: ${expectedGPTCount - actualGPTCount}`);
    
    // Get the actual GPT nodes from the workflow and determine required GPT numbers
    const actualGPTNodes = nodes.filter(node => node.type === 'gptTask');
    const requiredGPTNumbers: number[] = [];
    
    // Extract the actual GPT numbers from the workflow nodes
    actualGPTNodes.forEach(node => {
      const nodeLabel = (node.data?.label as string) || (node.data?.config as any)?.label || '';
      
      // First, try to extract from label (e.g., "GPT 3" -> 3)
      let nodeNumber = null as number | null;
      if (nodeLabel.trim()) {
        const labelMatch = nodeLabel.trim().match(/(\d+)/);
        if (labelMatch) {
          nodeNumber = parseInt(labelMatch[1]);
        }
      }
      
      // If no number from label, use nodeNumber from data
      if (!nodeNumber && (node as any).data?.nodeNumber) {
        nodeNumber = (node as any).data.nodeNumber as number;
      }
      
      // Try to extract from node ID as fallback
      if (!nodeNumber) {
        const idMatch = node.id.match(/(\d+)/);
        if (idMatch) {
          nodeNumber = parseInt(idMatch[1]);
        }
      }
      
      // Last fallback - use sequential numbering
      if (!nodeNumber) {
        const gptIndex = actualGPTNodes.findIndex(n => n.id === node.id);
        nodeNumber = gptIndex + 1;
      }
      
      if (nodeNumber && !requiredGPTNumbers.includes(nodeNumber)) {
        requiredGPTNumbers.push(nodeNumber);
      }
    });
    
    // Sort the required GPT numbers
    requiredGPTNumbers.sort((a, b) => a - b);
    
    console.log(`   Required GPT numbers based on workflow: [${requiredGPTNumbers.join(', ')}]`);
    
    // Debug: Show all available keys in accumulated workflow data
    const allGPTKeys = Object.keys(accumulatedWorkflowData).filter(key => key.startsWith('GPT'));
    console.log(`   All GPT-related keys in workflow data: [${allGPTKeys.join(', ')}]`);
    
    // Debug: Show a sample of what's actually stored
    console.log(`   Sample of accumulated workflow data keys: [${Object.keys(accumulatedWorkflowData).slice(0, 10).join(', ')}]`);
    
    const missingGPTResults: number[] = [];
    const availableGPTResults: number[] = [];
    
    // Check each required GPT result
    requiredGPTNumbers.forEach(num => {
      const gptKey = `GPT ${num}`;
      if (accumulatedWorkflowData[gptKey] && (accumulatedWorkflowData[gptKey] as any)?.result) {
        availableGPTResults.push(num);
        console.log(`   ✅ GPT ${num}: Available (${typeof (accumulatedWorkflowData[gptKey] as any).result === 'string' 
          ? (accumulatedWorkflowData[gptKey] as any).result.substring(0, 50) + '...'
          : 'Non-string result'})`);
      } else {
        missingGPTResults.push(num);
        console.log(`   ❌ GPT ${num}: Missing or empty`);
      }
    });

    console.log(`\n📋 GPT RESULTS STATUS:`);
    console.log(`   ✅ Available: GPT ${availableGPTResults.join(', GPT ')}`);
    if (missingGPTResults.length > 0) {
      console.log(`   ❌ Missing: GPT ${missingGPTResults.join(', GPT ')}`);
    }

    // CRITICAL: Check if ALL required GPT results are available
    const allGPTResultsAvailable = missingGPTResults.length === 0;
    
    console.log(`\n🎯 WEBHOOK RESPONSE VALIDATION:`);
    console.log(`   All GPT results available: ${allGPTResultsAvailable ? '✅ YES' : '❌ NO'}`);
    console.log(`   Missing results count: ${missingGPTResults.length}`);
    
    // Calculate success rate for more flexible handling
    const gptSuccessRate = availableGPTResults.length / requiredGPTNumbers.length;
    const minRequiredSuccessRate = 0.8; // Allow response if 80% of GPT tasks succeed
    
    console.log(`   GPT Success Rate: ${Math.round(gptSuccessRate * 100)}%`);
    console.log(`   Minimum Required: ${Math.round(minRequiredSuccessRate * 100)}%`);
    
    if (!allGPTResultsAvailable) {
      console.log(`\n⚠️ INCOMPLETE GPT RESULTS DETECTED:`);
      console.log(`   Missing: GPT ${missingGPTResults.join(', GPT ')}`);
      console.log(`   Available: GPT ${availableGPTResults.join(', GPT ')}`);
      console.log(`   Success Rate: ${Math.round(gptSuccessRate * 100)}%`);
      
      // Check if we have enough successful results to proceed
      if (gptSuccessRate >= minRequiredSuccessRate) {
        console.log(`\n✅ ALLOWING PARTIAL RESPONSE:`);
        console.log(`   Reason: Success rate (${Math.round(gptSuccessRate * 100)}%) meets minimum threshold`);
        console.log(`   Action: Proceeding with available GPT results`);
        console.log(`   Note: Missing GPT results will show as {{GPT X.result}} in response`);
        
        // Update execution status to indicate partial success
        if (executionId) {
          await supabase
            .from('workflow_executions')
            .update({
              status: 'partial_success',
              error_message: `Partial GPT results: Missing GPT ${missingGPTResults.join(', GPT ')} but proceeding`,
              error_details: {
                missing_gpt_results: missingGPTResults,
                available_gpt_results: availableGPTResults,
                success_rate: gptSuccessRate,
                total_expected: requiredGPTNumbers.length,
                total_completed: availableGPTResults.length
              }
            })
            .eq('id', executionId);
        }
      } else {
        console.log(`\n🚨 BLOCKING WEBHOOK RESPONSE:`);
        console.log(`   Reason: Success rate (${Math.round(gptSuccessRate * 100)}%) below minimum threshold (${Math.round(minRequiredSuccessRate * 100)}%)`);
        console.log(`   Missing: GPT ${missingGPTResults.join(', GPT ')}`);
        console.log(`   Action: Throwing error to prevent incomplete response to Make.com`);
        
        // Update execution status to indicate incomplete results
        if (executionId) {
          await supabase
            .from('workflow_executions')
            .update({
              status: 'incomplete',
              error_message: `Incomplete GPT results: Missing GPT ${missingGPTResults.join(', GPT ')}`,
              error_details: {
                missing_gpt_results: missingGPTResults,
                available_gpt_results: availableGPTResults,
                success_rate: gptSuccessRate,
                total_expected: requiredGPTNumbers.length,
                total_completed: availableGPTResults.length
              }
            })
            .eq('id', executionId);
        }
        
        throw new Error(`Incomplete workflow results: Missing GPT ${missingGPTResults.join(', GPT ')}. Success rate ${Math.round(gptSuccessRate * 100)}% below required ${Math.round(minRequiredSuccessRate * 100)}%.`);
      }
    }

    console.log(`\n✅ ALL VALIDATIONS PASSED - Proceeding with webhook response`);
    console.log('='.repeat(80));

    // Now execute the webhook response node with ALL results (HTTP + GPT)
    console.log('🎯 Executing webhook response node with ALL parallel results');
    console.log('🎯 Available data keys:', Object.keys(accumulatedWorkflowData).length);
    console.log('🎯 HTTP result keys:', Object.keys(accumulatedWorkflowData).filter(k => k.startsWith('HTTP')));
    console.log('🎯 GPT result keys:', Object.keys(accumulatedWorkflowData).filter(k => k.startsWith('GPT')));

    // Update execution tracking for webhook response
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          current_node_id: webhookResponseNode.id,
          executed_nodes: Array.from(executedNodes)
        })
        .eq('id', executionId);
    }

    executedNodes.add(webhookResponseNode.id);

    // Resolve and execute webhook response node
    const resolvedWebhookNode = {
      ...webhookResponseNode,
      data: {
        ...webhookResponseNode.data,
        config: replaceParameters(webhookResponseNode.data?.config, accumulatedWorkflowData)
      }
    };

    const webhookResult = await executeNode(resolvedWebhookNode as WorkflowNode, accumulatedWorkflowData, supabase);
    
    if ((webhookResult as any)?.webhook_response) {
      webhookResponseResult = (webhookResult as any).webhook_response;
      console.log('🎯 WEBHOOK RESPONSE with all HTTP results:', webhookResponseResult);
    }

    // Mark execution as completed
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          executed_nodes: Array.from(executedNodes),
          result_data: {
            optimizedParallelExecution: true,
            httpTaskCount: nodeTypeCounts.get('httpTask') || 0,
            gptTaskCount: nodeTypeCounts.get('gptTask') || 0,
            totalParallelTasks: (nodeTypeCounts.get('httpTask') || 0) + (nodeTypeCounts.get('gptTask') || 0),
            completedAt: new Date().toISOString(),
            nodeResults: { [webhookResponseNode.id]: webhookResult },
            workflowData: accumulatedWorkflowData
          }
        })
        .eq('id', executionId);
    }

    return {
      message: 'Workflow completed with parallel HTTP and GPT optimization',
      data: accumulatedWorkflowData,
      status: 'completed',
      executedNodes: Array.from(executedNodes),
      nodeCount: executedNodes.size,
      httpTaskCount: nodeTypeCounts.get('httpTask') || 0,
      gptTaskCount: nodeTypeCounts.get('gptTask') || 0,
      totalParallelTasks: (nodeTypeCounts.get('httpTask') || 0) + (nodeTypeCounts.get('gptTask') || 0),
      executionId: executionId || null,
      hasWebhookResponse: true,
      webhookResponse: webhookResponseResult,
      parallelOptimized: true
    };

  } catch (error) {
    const err = ensureError(error);
    
    console.log('\n' + '='.repeat(80));
    console.log('🚨 WORKFLOW EXECUTION FAILED');
    console.log('='.repeat(80));
    console.log(`❌ Error Type: ${err.name || 'Unknown'}`);
    console.log(`❌ Error Message: ${err.message}`);
    
    // Categorize the error for better handling
    let errorCategory = 'unknown';
    let shouldReturnError = true;
    
    if (err.message.includes('Incomplete workflow results') || err.message.includes('Missing GPT')) {
      errorCategory = 'incomplete_results';
      console.log(`🔍 Error Category: Incomplete Results`);
      console.log(`📝 Reason: Some GPT tasks failed or didn't complete`);
      console.log(`🎯 Action: Blocking response to prevent partial data to Make.com`);
      shouldReturnError = true;
    } else if (err.message.includes('timed out') || err.message.includes('timeout')) {
      errorCategory = 'timeout';
      console.log(`🔍 Error Category: Timeout`);
      console.log(`📝 Reason: Tasks took too long to complete`);
      console.log(`🎯 Action: Blocking response due to timeout`);
      shouldReturnError = true;
    } else if (err.message.includes('Too many parallel tasks failed')) {
      errorCategory = 'multiple_failures';
      console.log(`🔍 Error Category: Multiple Task Failures`);
      console.log(`📝 Reason: More than 50% of tasks failed`);
      console.log(`🎯 Action: Blocking response due to high failure rate`);
      shouldReturnError = true;
    } else {
      errorCategory = 'system_error';
      console.log(`🔍 Error Category: System Error`);
      console.log(`📝 Reason: Unexpected system failure`);
      console.log(`🎯 Action: Blocking response due to system error`);
      shouldReturnError = true;
    }
    
    // Update execution record with detailed error info
    if (executionId) {
      console.log(`📝 Updating execution record ${executionId} with error details`);
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: err.message,
          error_details: {
            error_category: errorCategory,
            error_type: err.name || 'Unknown',
            timestamp: new Date().toISOString(),
            should_return_error: shouldReturnError
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }
    
    console.log(`\n🚫 BLOCKING RESPONSE TO MAKE.COM`);
    console.log(`   Reason: ${errorCategory}`);
    console.log(`   Message: ${err.message}`);
    console.log('='.repeat(80));
    
    throw err;
  }
}

// Helper function to find parallel GPT task groups
function findParallelGptGroups(nodes: WorkflowNode[], edges: WorkflowEdge[], webhookResponseNodeId: string): string[][] {
  const gptNodes = nodes.filter(node => node.type === 'gptTask');
  
  // Filter GPT nodes that have a path to webhook response
  const relevantGptNodes = gptNodes.filter(gptNode => {
    // Check if there's a path from this GPT node to webhook response
    return hasPathToTarget(edges, gptNode.id, webhookResponseNodeId);
  });

  // For now, treat all relevant GPT nodes as one parallel group
  // In future, we could analyze dependencies between GPT nodes
  if (relevantGptNodes.length > 0) {
    return [relevantGptNodes.map(node => node.id)];
  }
  
  return [];
}

// Helper function to execute a parallel task (HTTP or GPT) with timeout and retry
async function executeParallelTask(
  nodeId: string, 
  nodes: WorkflowNode[], 
  accumulatedWorkflowData: Record<string, unknown>, 
  executedNodes: Set<string>, 
  executionId: string | null, 
  supabase: SupabaseClientType,
  taskType: 'httpTask' | 'gptTask'
): Promise<{
  nodeId: string;
  node: WorkflowNode;
  result: unknown;
  failed?: boolean;
  taskType: 'httpTask' | 'gptTask';
  retryCount?: number;
  executionTime?: number;
} | null> {
  const node = nodes.find((n: WorkflowNode) => n.id === nodeId);
  if (!node) return null;

  const startTime = Date.now();
  const maxRetries = 2; // 2 retries for parallel tasks
  const taskTimeout = taskType === 'gptTask' ? 120000 : 30000; // 2 min for GPT, 30 sec for HTTP
  
  let retryCount = 0;
  let lastError: Error | null = null;

  console.log(`⚡ Starting parallel ${taskType} ${nodeId} (timeout: ${taskTimeout}ms, retries: ${maxRetries})`);
  
  // Update execution tracking
  if (executionId) {
    await supabase
      .from('workflow_executions')
      .update({
        current_node_id: nodeId,
        executed_nodes: Array.from(executedNodes)
      })
      .eq('id', executionId);
  }

  executedNodes.add(nodeId);

  while (retryCount <= maxRetries) {
  try {
      console.log(`⚡ ${taskType} ${nodeId} attempt ${retryCount + 1}/${maxRetries + 1} (timeout: ${taskTimeout}ms)`);
      
    // Resolve node configuration with parameter replacement
    const resolvedNode = {
      ...node,
      data: {
        ...node.data,
        config: replaceParameters(node.data?.config, accumulatedWorkflowData)
      }
    };

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${taskType} ${nodeId} timed out after ${taskTimeout}ms`)), taskTimeout);
      });

      // Execute task with timeout
      const taskPromise = executeNode(resolvedNode, accumulatedWorkflowData, supabase);
      const nodeResult = await Promise.race([taskPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Parallel ${taskType} ${nodeId} completed in ${executionTime}ms (attempt ${retryCount + 1})`);
      
    return {
      nodeId,
      node,
      result: nodeResult,
        taskType,
        retryCount,
        executionTime
    };
      
  } catch (error) {
      lastError = ensureError(error);
      retryCount++;
      
      console.error(`❌ Parallel ${taskType} ${nodeId} attempt ${retryCount} failed:`, lastError.message);
      
      if (retryCount <= maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        console.log(`⏳ Retrying ${taskType} ${nodeId} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const executionTime = Date.now() - startTime;
  console.error(`❌ Parallel ${taskType} ${nodeId} failed after ${maxRetries + 1} attempts in ${executionTime}ms`);
  
    return {
      nodeId,
      node,
    result: { error: lastError?.message || `${taskType} failed after all retries` },
      failed: true,
    taskType,
    retryCount,
    executionTime
    };
}

// Helper function to find parallel HTTP task groups  
function findParallelHttpGroups(nodes: WorkflowNode[], edges: WorkflowEdge[], webhookResponseNodeId: string): string[][] {
  const httpNodes = nodes.filter(node => node.type === 'httpTask');
  if (httpNodes.length === 0) return [];
  
  // Find HTTP nodes that connect to the webhook response node
  const httpToWebhookNodes = httpNodes.filter(httpNode => {
    // Check if there's a path from this HTTP node to webhook response
    return hasPathToTarget(edges, httpNode.id, webhookResponseNodeId);
  });
  
  if (httpToWebhookNodes.length <= 1) return [];
  
  // Group HTTP nodes that can run in parallel (same "level" in the workflow)
  const parallelGroups: string[][] = [];
  const processedNodes = new Set<string>();
  
  for (const httpNode of httpToWebhookNodes) {
    if (processedNodes.has(httpNode.id)) continue;
    
    // Find all HTTP nodes at the same level (parallel group)
    const parallelGroup = [httpNode.id];
    processedNodes.add(httpNode.id);
    
    // Find other HTTP nodes that are at the same "depth" from trigger
    const httpDepth = getNodeDepthFromTrigger(nodes, edges, httpNode.id);
    
    for (const otherHttpNode of httpToWebhookNodes) {
      if (processedNodes.has(otherHttpNode.id)) continue;
      
      const otherDepth = getNodeDepthFromTrigger(nodes, edges, otherHttpNode.id);
      if (otherDepth === httpDepth) {
        parallelGroup.push(otherHttpNode.id);
        processedNodes.add(otherHttpNode.id);
      }
    }
    
    if (parallelGroup.length > 1) {
      parallelGroups.push(parallelGroup);
    } else if (parallelGroup.length === 1) {
      // Single HTTP node, still add as a group
      parallelGroups.push(parallelGroup);
    }
  }
  
  return parallelGroups;
}

// Helper function to check if there's a path from source to target
function hasPathToTarget(edges: WorkflowEdge[], sourceId: string, targetId: string): boolean {
  const visited = new Set<string>();
  
  function dfs(currentId: string): boolean {
    if (currentId === targetId) return true;
    if (visited.has(currentId)) return false;
    
    visited.add(currentId);
    
    const outgoingEdges = edges.filter(edge => edge.source === currentId);
    for (const edge of outgoingEdges) {
      if (dfs(edge.target)) return true;
    }
    
    return false;
  }
  
  return dfs(sourceId);
}

// Helper function to get node depth from trigger
function getNodeDepthFromTrigger(nodes: WorkflowNode[], edges: WorkflowEdge[], nodeId: string): number {
  const triggerNode = nodes.find(node => node.type === 'trigger');
  if (!triggerNode) return 0;
  
  const visited = new Set<string>();
  
  function findDepth(currentId: string, depth: number): number {
    if (currentId === nodeId) return depth;
    if (visited.has(currentId)) return -1;
    
    visited.add(currentId);
    
    const outgoingEdges = edges.filter(edge => edge.source === currentId);
    for (const edge of outgoingEdges) {
      const result = findDepth(edge.target, depth + 1);
      if (result !== -1) return result;
    }
    
    return -1;
  }
  
  return findDepth(triggerNode.id, 0);
}

// Helper function to build execution order from trigger to webhook response node
async function buildExecutionOrderToWebhookResponse(nodes: WorkflowNode[], edges: WorkflowEdge[], startNodeId: string, targetNodeId: string): Promise<string[]> {
  const visited = new Set<string>();
  const executionOrder: string[] = [];
  
  function findPath(currentNodeId: string): boolean {
    if (visited.has(currentNodeId)) return false;
    
    visited.add(currentNodeId);
    executionOrder.push(currentNodeId);
    
    if (currentNodeId === targetNodeId) {
      return true; // Found target
    }
    
    // Find outgoing edges from current node
    const outgoingEdges = edges.filter((edge: any) => edge.source === currentNodeId);
    
    for (const edge of outgoingEdges) {
      if (findPath(edge.target)) {
        return true; // Path found through this edge
      }
    }
    
    // Backtrack if no path found
    executionOrder.pop();
    return false;
  }
  
  findPath(startNodeId);
  return executionOrder;
}

// Background processing function
async function continueWorkflowInBackground(
  remainingNodes: WorkflowNode[], 
  edges: WorkflowEdge[], 
  accumulatedWorkflowData: Record<string, unknown>, 
  executedNodes: Set<string>, 
  supabase: SupabaseClientType, 
  executionId: string | null,
  nodeTypeCounts: Map<string, number>
): Promise<void> {
  console.log('🔄 Background processing started for remaining nodes');
  
  try {
    // Continue with remaining workflow processing
    // This is a simplified version - you could implement the full parallel execution logic here
    for (const node of remainingNodes) {
      if (executedNodes.has(node.id)) continue;
      
      console.log(`🔄 Background executing ${node.type} (${node.id})`);
      
      try {
        const resolvedNode = {
          ...node,
          data: {
            ...node.data,
            config: replaceParameters(node.data?.config, accumulatedWorkflowData)
          }
        };
        
        const nodeResult = await executeNode(resolvedNode, accumulatedWorkflowData, supabase);
        executedNodes.add(node.id);
        
        // Store result
        if (nodeResult && typeof nodeResult === 'object') {
          const safeNodeResult = JSON.parse(JSON.stringify(nodeResult));
          accumulatedWorkflowData[node.id] = safeNodeResult;
        }
        
        console.log(`✅ Background completed ${node.type} (${node.id})`);
        
      } catch (error) {
        console.error(`❌ Background node ${node.id} failed:`, error);
        // Continue with other nodes even if one fails
      }
    }
    
    // Mark execution as completed
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          executed_nodes: Array.from(executedNodes)
        })
        .eq('id', executionId);
    }
    
    console.log('✅ Background processing completed');
    
  } catch (error) {
    console.error('❌ Background processing failed:', error);
    const err = ensureError(error);
    
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: `Background processing failed: ${err.message}`
        })
        .eq('id', executionId);
    }
  }
}

// Original processWorkflow function (kept for workflows without webhook response nodes)
async function processWorkflow(
  workflowData: WorkflowData, 
  inputData: Record<string, unknown>, 
  supabase: SupabaseClientType, 
  webhookRequestId?: string, 
  workflowId?: string, 
  userId?: string
): Promise<WorkflowResult> {
  const { nodes, edges } = workflowData;
  
  // Precompute GPT node numbering maps (prefer stored nodeNumber, fallback to creation order by id)
  const gptNodesAll = Array.isArray(nodes)
    ? (nodes as WorkflowNode[]).filter((n) => n.type === 'gptTask')
    : [];
  const extractNumeric = (id: string) => {
    const m = id?.match(/(\d{6,}|\d+)$/);
    return m ? Number(m[1]) : 0;
  };
  const gptCreationSorted = [...gptNodesAll].sort(
    (a, b) => extractNumeric(a.id) - extractNumeric(b.id)
  );
  const gptIdToCreationIndex = new Map<string, number>();
  gptCreationSorted.forEach((n, i) => gptIdToCreationIndex.set(n.id, i + 1));
  const gptIdToPreferredNumber = new Map<string, number>();
  gptNodesAll.forEach((n) => {
    const num = typeof n.data?.nodeNumber === 'number'
      ? n.data.nodeNumber
      : gptIdToCreationIndex.get(n.id) || 1;
    gptIdToPreferredNumber.set(n.id, num);
  });
  
  // Check if workflow has webhook response node
  const hasWebhookResponseNode = nodes.some((node: WorkflowNode) => node.type === 'webhookResponse');
  
  // Initialize workflow data that accumulates results from each node
  const accumulatedWorkflowData: Record<string, unknown> = {
    originalTriggerData: inputData,
    trigger: inputData,
    data: inputData,
    webhookRequestBody: inputData,
    // CRITICAL: Also add all individual fields from inputData at root level for easy parameter access
    ...inputData
  };
  
  // Ensure all webhook fields are available for parameter replacement
  if (inputData && typeof inputData === 'object') {
    Object.keys(inputData).forEach(key => {
      if (key.match(/^(prompt|image_size|keyword|seo)\d*$/)) {
        accumulatedWorkflowData[key] = inputData[key];
      }
    });
  }
  
  console.log('🎯 Initial trigger data stored with keys:', Object.keys(accumulatedWorkflowData));
  console.log('🎯 Available numbered fields for parameter replacement:', Object.keys(accumulatedWorkflowData).filter(k => k.match(/^(prompt|image_size|keyword|seo)\d*$/)));
  console.log('🎯 originalTriggerData sample:', JSON.stringify(accumulatedWorkflowData.originalTriggerData, null, 2).substring(0, 500));
  
  // Add trigger data with multiple numbering options for compatibility
  console.log('🎯 Creating trigger objects with inputData:', Object.keys(inputData));
  for (let i = 1; i <= 10; i++) {
    accumulatedWorkflowData[`Trigger ${i}`] = {
      body: inputData,
      ...inputData
    };
  }
  
  // Log what's actually in Trigger 3 for debugging
  console.log('🎯 Trigger 3 contains:', Object.keys(accumulatedWorkflowData['Trigger 3'] || {}));
  console.log('🎯 Trigger 3 data sample:', JSON.stringify(accumulatedWorkflowData['Trigger 3'], null, 2).substring(0, 500));
  
  let executionId: string | null = null;
  let webhookResponseResult: WorkflowResult['webhookResponse'] | null = null;
  const executedNodes = new Set<string>();
  
  try {
    // Create workflow execution record for real-time tracking
    if (workflowId && userId && webhookRequestId) {
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          webhook_request_id: webhookRequestId,
          user_id: userId,
          status: 'running',
          executed_nodes: [],
          current_node_id: null
        })
        .select()
        .single();

      if (execution && !execError) {
        const executionIdentifier = typeof execution.id === 'string'
          ? execution.id
          : execution.id != null
            ? String(execution.id)
            : null;

        if (executionIdentifier) {
          executionId = executionIdentifier;
        }

        console.log('Created workflow execution record:', executionId);
      }
    }

    // Find the trigger node (webhook trigger)
    const triggerNode = nodes.find((node: WorkflowNode) => node.type === 'trigger');
    if (!triggerNode) {
      console.log('No trigger node found, returning input data');
      return { message: 'No workflow trigger found', data: accumulatedWorkflowData };
    }

    // Execute nodes with automatic parallel/sequential detection based on connections
    let batchIndex = 1;
    
    // Keep track of node counts by type for proper labeling
    const nodeTypeCounts = new Map<string, number>();
    
    // Start with trigger node
    let currentNodes = [triggerNode.id];
    
    while (currentNodes.length > 0) {
      const nodesToExecute = [];
      
      // Collect all nodes to execute in this batch
      for (const nodeId of currentNodes) {
        if (!executedNodes.has(nodeId)) {
          const node = nodes.find((n: WorkflowNode) => n.id === nodeId);
          if (node) {
            nodesToExecute.push(node);
          }
        }
      }
      
      if (nodesToExecute.length === 0) break;
      
      console.log(`\n🚀 Executing ${nodesToExecute.length} nodes in parallel (batch ${batchIndex})`);
      
      // Execute all nodes in parallel
      const parallelResults = await Promise.all(
        nodesToExecute.map(async (currentNode) => {
          if (executedNodes.has(currentNode.id)) {
            return { nodeId: currentNode.id, result: null, skipped: true, nodeType: currentNode.type, node: currentNode };
          }
          
          console.log(`  ⚡ Starting ${currentNode.type} (${currentNode.id})`);
          console.log(`  📊 Available data keys: ${Object.keys(accumulatedWorkflowData).join(', ')}`);
          
          // Update execution tracking - node started
          if (executionId) {
            await supabase
              .from('workflow_executions')
              .update({
                current_node_id: currentNode.id,
                executed_nodes: Array.from(executedNodes)
              })
              .eq('id', executionId);
          }
          
          executedNodes.add(currentNode.id);

          try {
            // 1. Clone and resolve node configuration with parameter replacement
            const resolvedNode: WorkflowNode = {
              ...currentNode,
              data: {
                ...currentNode.data,
                config: replaceParameters(currentNode.data?.config, accumulatedWorkflowData) as Record<string, unknown>
              }
            };
            
            console.log(`  📝 Node ${currentNode.id} resolved config:`, JSON.stringify(resolvedNode.data.config, null, 2));

            // 2. Execute the node with resolved configuration
            const nodeResult = await executeNode(resolvedNode as WorkflowNode, accumulatedWorkflowData, supabase);
            
            console.log(`  ✅ Node ${currentNode.type} (${currentNode.id}) completed`);
            
            return {
              nodeId: currentNode.id,
              nodeType: currentNode.type,
              result: nodeResult,
              node: currentNode
            };
          } catch (error) {
            const err = ensureError(error);
            console.error(`  ❌ Node ${currentNode.type} (${currentNode.id}) failed:`, error);
            return {
              nodeId: currentNode.id,
              nodeType: currentNode.type,
              result: { error: err.message },
              node: currentNode,
              failed: true
            };
          }
        })
      );
      
      // Process results and update accumulated data
      for (const { nodeId, nodeType, result, node, skipped, failed } of parallelResults) {
        if (skipped) continue;
        
        // 3. Check for failed nodes and stop execution
        if (failed) {
          console.error(`❌ Node execution failed, stopping workflow: ${nodeId} (${nodeType})`);
          
          // Update execution status to failed with error details
          if (executionId) {
            await supabase
              .from('workflow_executions')
              .update({
                status: 'failed',
                error_details: {
                  failed_node_id: nodeId,
                  failed_node_type: nodeType,
                  error_message: result?.error || 'Unknown error',
                  executed_nodes: Array.from(executedNodes)
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', executionId);
          }
          
          // Send real-time update about the failed node
          const channel = supabase.channel(`workflow-execution-${executionId}`);
          await channel.send({
            type: 'broadcast',
            event: 'node_failed',
            payload: {
              nodeId,
              nodeType,
              error: result?.error || 'Unknown error',
              executionId
            }
          });
          
          throw new Error(`Node ${nodeId} (${nodeType}) failed: ${result?.error || 'Unknown error'}`);
        }
        
        // 4. Check if this is a webhook response node
        if (nodeType === 'webhookResponse') {
          if ((result as any)?.webhook_response) {
            webhookResponseResult = (result as any).webhook_response;
            console.log(`🎯 Found webhook response from node ${nodeId}:`, webhookResponseResult);
          }
        }
        
        // Get or increment the count for this node type (only for successful nodes)
        const currentCount = nodeTypeCounts.get(nodeType) || 0;
        const nodeIndex = currentCount + 1;
        nodeTypeCounts.set(nodeType, nodeIndex);
        
        // 5. Save result for other nodes to reference
        if (result && typeof result === 'object') {
          // Create a safe copy of result without circular references
          const safeNodeResult = JSON.parse(JSON.stringify(result));
          
          // Get the node label from node data
          const nodeLabel = (node as any).data?.label || (node as any).data?.config?.label || '';
          
          // Store result with multiple reference patterns
          const nodeRefName = `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} ${nodeIndex}`;
          const shortNodeRef = `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}`;
          
          accumulatedWorkflowData[nodeId] = safeNodeResult;
          accumulatedWorkflowData[nodeRefName] = safeNodeResult;
          accumulatedWorkflowData[shortNodeRef] = safeNodeResult;

          // Special aliases for HTTP to match UI parameters like "HTTP 1.response"
          if (nodeType === 'httpTask') {
            accumulatedWorkflowData[`HTTP ${nodeIndex}`] = safeNodeResult;
            if (!accumulatedWorkflowData['HTTP']) {
              accumulatedWorkflowData['HTTP'] = safeNodeResult;
            }
            // Common label-style alias
            accumulatedWorkflowData[`HTTP Request ${nodeIndex}`] = safeNodeResult;
            if (!accumulatedWorkflowData['HTTP Request']) {
              accumulatedWorkflowData['HTTP Request'] = safeNodeResult;
            }
          }
          
          // Store under the actual node label if it exists
          if (nodeLabel.trim()) {
            accumulatedWorkflowData[nodeLabel.trim()] = safeNodeResult;
            console.log(`  💾 Stored under label: ${nodeLabel.trim()}`);
          }
          
          // For GPT nodes, store with deterministic keys based on node configuration
          if (nodeType === 'gptTask') {
            // Extract number from node label (e.g., "GPT 3" -> 3) as the primary source
            let nodeNumber = null;
            
            // First, try to extract from label - be more flexible with parsing
            if (nodeLabel.trim()) {
              const labelMatch = nodeLabel.trim().match(/(\d+)/);
              if (labelMatch) {
                nodeNumber = parseInt(labelMatch[1]);
              }
            }
            
            // If no number from label, use nodeNumber from data
            if (!nodeNumber && (node as any).data?.nodeNumber) {
              nodeNumber = (node as any).data.nodeNumber as number;
            }
            
            // Try to extract from node ID as fallback (in case it contains a number)
            if (!nodeNumber) {
              const idMatch = nodeId.match(/(\d+)/);
              if (idMatch) {
                nodeNumber = parseInt(idMatch[1]);
              }
            }
            
            // Last fallback - use a unique identifier based on position in nodes array
            if (!nodeNumber) {
              // Find the position of this GPT node in the list of ALL GPT nodes (sorted by creation order)
              const allGptNodes = nodes
                .filter((n: WorkflowNode) => n.type === 'gptTask')
                .sort((a: WorkflowNode, b: WorkflowNode) => {
                  // Sort by node creation timestamp if available, otherwise by ID
                  const aTime = (a as any).data?.createdAt || a.id;
                  const bTime = (b as any).data?.createdAt || b.id;
                  return aTime.localeCompare(bTime);
                });
              
              const gptIndex = allGptNodes.findIndex((n: WorkflowNode) => n.id === nodeId);
              nodeNumber = gptIndex >= 0 ? gptIndex + 1 : nodeIndex;
            }
            
            console.log(`🔍 GPT Node Debug:`, {
              nodeId,
              nodeLabel: nodeLabel.trim(),
              extractedFromLabel: nodeLabel.trim().match(/(\d+)/)?.[1],
              nodeDataNumber: (node as any).data?.nodeNumber,
              idExtracted: nodeId.match(/(\d+)/)?.[1],
              fallbackNodeIndex: nodeIndex,
              finalNodeNumber: nodeNumber,
              dataKeys: Object.keys((node as any).data || {})
            });
            
            // Store under the exact node number that appears in the UI
            accumulatedWorkflowData[`GPT ${nodeNumber}`] = safeNodeResult;
            accumulatedWorkflowData[`GPT Task ${nodeNumber}`] = safeNodeResult;
            
            // Also store under node ID for internal reference
            accumulatedWorkflowData[nodeId] = safeNodeResult;
            
            // Store under the node label if it exists (for UI display purposes)
            if (nodeLabel.trim()) {
              accumulatedWorkflowData[nodeLabel.trim()] = safeNodeResult;
            }
            
            // Also store under both potential label formats
            if (nodeLabel.trim() && nodeLabel.includes('GPT')) {
              // Extract number from label if possible (e.g., "GPT 3" -> 3)
              const labelMatch = nodeLabel.match(/GPT\s*(\d+)/i);
              if (labelMatch) {
                const labelNumber = parseInt(labelMatch[1]);
                accumulatedWorkflowData[`GPT ${labelNumber}`] = safeNodeResult;
                accumulatedWorkflowData[`GPT Task ${labelNumber}`] = safeNodeResult;
                console.log(`📝 Also stored under label-derived key: GPT ${labelNumber}`);
              }
            }
            
            // Generic fallback only for the first GPT node
            if (!accumulatedWorkflowData['GPT']) {
              accumulatedWorkflowData['GPT'] = safeNodeResult;
              accumulatedWorkflowData['GPT Task'] = safeNodeResult;
            }
            
            console.log(`🧠 GPT Node ${nodeId} stored as "GPT ${nodeNumber}" with result:`, typeof safeNodeResult.result === 'string' ? safeNodeResult.result.substring(0, 100) : safeNodeResult.result);
            console.log(`🔑 All GPT storage keys for this node:`, [`GPT ${nodeNumber}`, `GPT Task ${nodeNumber}`, nodeId, nodeLabel.trim()].filter(k => k));
          }
          
          // For Trigger nodes, store with flexible numeric references to handle UI references
          if (nodeType === 'trigger') {
            // Always store under Trigger 3 since that's what the UI commonly references
            // Also store under multiple keys for flexibility
            const triggerKeys = ['Trigger 1', 'Trigger 2', 'Trigger 3', 'Trigger 4', 'Trigger 5'];
            
            for (const key of triggerKeys) {
              accumulatedWorkflowData[key] = safeNodeResult;
            }
            
            // Also store generic aliases
            accumulatedWorkflowData['Trigger'] = safeNodeResult;
            accumulatedWorkflowData['Webhook Trigger'] = safeNodeResult;
            
            console.log(`🎯 Trigger Node Debug:`, {
              nodeId,
              nodeLabel: nodeLabel.trim(),
              dataKeys: Object.keys(safeNodeResult || {}),
              sampleFields: Object.keys(safeNodeResult || {}).filter(k => k.match(/^(prompt|image_size)\d*$/)),
              storedUnderKeys: triggerKeys
            });
            
            console.log(`🎯 Trigger Node ${nodeId} stored under multiple keys for compatibility`);
            console.log(`🎯 Available trigger fields:`, Object.keys(safeNodeResult || {}).filter(k => k.match(/^(prompt|image_size|keyword|seo)\d*$/)));
          }
          
          console.log(`  💾 Stored node result under keys: ${[nodeId, nodeRefName, shortNodeRef, nodeLabel.trim()].filter(k => k).join(', ')}`);
        }

        // Update execution tracking - node completed
        if (executionId) {
          // Get existing result_data to preserve all node results
          const { data: existingExecution } = await supabase
            .from('workflow_executions')
            .select('result_data')
            .eq('id', executionId)
            .single();
          
          const existingNodeResults = extractNodeResults(existingExecution);
          
          const resultDataWithNodes = {
            nodeCount: Object.keys(accumulatedWorkflowData).length,
            lastNodeType: nodeType,
            lastNodeId: nodeId,
            nodeResults: {
              ...existingNodeResults,
              [nodeId]: result
            },
            // Store the accumulated workflow data for webhook response access
            workflowData: accumulatedWorkflowData
          };
          
          await supabase
            .from('workflow_executions')
            .update({
              executed_nodes: Array.from(executedNodes),
              result_data: resultDataWithNodes
            })
            .eq('id', executionId);
        }
      }
      
      console.log(`✅ Parallel batch ${batchIndex} completed. Available data keys:`, Object.keys(accumulatedWorkflowData));
      
      // CORE PARALLEL EXECUTION ALGORITHM: Check for RouterNode with parallel execution
      const nextBatchNodes = new Set<string>();
      const parallelBranches = new Map<string, string[]>(); // nodeId -> [branchTargets]
      
      // For each currently executed node, analyze for parallel execution patterns
      for (const nodeId of currentNodes) {
        const currentNode = nodes.find((n: WorkflowNode) => n.id === nodeId);
        const connectedEdges = edges.filter((edge: WorkflowEdge) => edge.source === nodeId);
        
        console.log(`🔗 Node ${nodeId} (type: ${currentNode?.type}) has ${connectedEdges.length} outgoing connections`);
        
        // Branch Discovery: Check if this is a RouterNode with parallel execution mode
        if (currentNode?.type === 'router' && (currentNode.data?.config as any)?.executionMode === 'parallel') {
          console.log(`🔀 PARALLEL ROUTER DETECTED: ${nodeId} - executing ALL ${connectedEdges.length} branches simultaneously`);
          
          // Concurrent Execution: Collect ALL outgoing edges for parallel execution
          const branchTargets: string[] = [];
          for (const edge of connectedEdges) {
            if (!executedNodes.has(edge.target)) {
              nextBatchNodes.add(edge.target);
              branchTargets.push(edge.target);
              console.log(`  🌟 PARALLEL BRANCH: Adding ${edge.target} to parallel execution batch`);
            }
          }
          
          if (branchTargets.length > 0) {
            parallelBranches.set(nodeId, branchTargets);
            console.log(`  📋 Router ${nodeId} will execute branches in parallel: [${branchTargets.join(', ')}]`);
          }
        } else {
          // Regular sequential logic for non-parallel routers and other nodes
          for (const edge of connectedEdges) {
            if (!executedNodes.has(edge.target)) {
              nextBatchNodes.add(edge.target);
              console.log(`  ➡️  Adding ${edge.target} to next batch (sequential)`);
            }
          }
        }
      }
      
      // Data Distribution: Log parallel branch execution summary
      if (parallelBranches.size > 0) {
        console.log(`🚀 PARALLEL EXECUTION SUMMARY:`);
        for (const [routerId, branches] of parallelBranches) {
          console.log(`  Router ${routerId}: [${branches.join(', ')}] will receive identical data copies`);
        }
      }
      
      // Execute next batch (all nodes will run in parallel via Promise.all)
      if (nextBatchNodes.size > 0) {
        currentNodes = Array.from(nextBatchNodes);
        console.log(`🚀 Next batch will execute ${currentNodes.length} nodes in PARALLEL: [${currentNodes.join(', ')}]`);
      } else {
        currentNodes = [];
        console.log(`🏁 No more nodes to execute`);
      }
      batchIndex++;
      
      if (currentNodes.length > 0) {
        console.log(`➡️  Moving to next parallel batch: ${currentNodes.join(', ')}`);
      } else {
        console.log('🏁 No more nodes to execute');
      }
    }

    console.log(`Workflow execution completed. Executed ${executedNodes.size} nodes:`, Array.from(executedNodes));

    // Mark execution as completed
    if (executionId) {
      // Get existing result_data to preserve all node results
      const { data: existingExecution } = await supabase
        .from('workflow_executions')
        .select('result_data')
        .eq('id', executionId)
        .single();
      
      const existingNodeResults = extractNodeResults(existingExecution);
      
      // Create a comprehensive completion summary that preserves node results
      const completionSummary = {
        totalNodes: Object.keys(accumulatedWorkflowData).length,
        executedNodeCount: executedNodes.size,
        completedAt: new Date().toISOString(),
        status: 'completed',
        nodeResults: existingNodeResults,
        // Store the final accumulated workflow data
        workflowData: accumulatedWorkflowData
      };
      
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_data: completionSummary,
          executed_nodes: Array.from(executedNodes)
        })
        .eq('id', executionId);
    }

    return {
      message: 'Workflow executed successfully',
      data: accumulatedWorkflowData,
      status: 'completed',
      executedNodes: Array.from(executedNodes),
      nodeCount: executedNodes.size,
      executionId: executionId || null,
      hasWebhookResponse: hasWebhookResponseNode,
      webhookResponse: webhookResponseResult
    };

  } catch (error) {
    console.error('Error processing workflow:', error);
    const err = ensureError(error);
    
    // Mark execution as failed
    if (executionId) {
      const currentExecutedNodes = Array.from(executedNodes);
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: err.message,
          executed_nodes: currentExecutedNodes
        })
        .eq('id', executionId);
    }
    
    return {
      error: 'Workflow execution failed',
      message: err.message,
      data: accumulatedWorkflowData
    };
  }
}

async function executeNode(node: WorkflowNode, data: Record<string, unknown>, supabase: SupabaseClientType): Promise<unknown> {
  console.log(`Executing node type: ${node.type} with data keys:`, Object.keys(data));
  
  switch (node.type) {
    case 'trigger': {
      // Trigger node should expose the webhook data at the top level for easy access
      console.log('Trigger node executed, passing data through');
      console.log('🎯 Trigger input data structure:', JSON.stringify(data, null, 2));
      
      // Create a flattened result that exposes webhook fields directly
      const rawNestedData = data.data;
      const nestedData = isRecord(rawNestedData) ? rawNestedData : {};
      const rawOriginalTriggerData = data.originalTriggerData;
      const originalTriggerData = isRecord(rawOriginalTriggerData) ? rawOriginalTriggerData : {};
      const originalRequestData = Object.keys(originalTriggerData).length > 0 ? originalTriggerData : data;
      const bodySource = Object.keys(nestedData).length > 0 ? nestedData : originalRequestData;
      const numberedFieldValues = {
        ...extractNumberedFields(originalTriggerData),
        ...extractNumberedFields(data)
      };

      const triggerResult: Record<string, unknown> = {
        ...data,
        ...nestedData,
        ...originalTriggerData,
        ...numberedFieldValues,
        body: bodySource,
        originalRequest: originalRequestData,
        webhookData: {
          request_body: originalRequestData
        }
      };
      
      console.log(`🎯 Trigger Result keys:`, Object.keys(triggerResult));
      console.log(`🎯 Found numbered fields in trigger result:`, Object.keys(triggerResult).filter(k => k.match(/^(prompt|image_size|keyword|seo)\d*$/)));
      return triggerResult;
    }

    case 'gptTask':  // Frontend uses 'gptTask', not 'gpt-task'
      console.log('Executing GPT Task node');
      return await executeGPTTask(node, data);

    case 'httpTask':  // Frontend uses 'httpTask', not 'http-task'
      console.log('Executing HTTP Task node');
      return await executeHTTPTask(node, data);

    case 'conditional':
      console.log('Executing Conditional node');
      return await executeConditional(node, data);

    case 'dataTransform':  // Frontend uses 'dataTransform', not 'data-transform'
      console.log('Executing Data Transform node');
      return await executeDataTransform(node, data);

    case 'webhookResponse':  // Frontend uses 'webhookResponse', not 'webhook-response'
      console.log('Executing Webhook Response node');
      return await executeWebhookResponse(node, data);

    case 'router':
      console.log('Executing Router node');
      return await executeRouter(node, data);

    default:
      console.log(`Unknown node type: ${node.type}, passing data through`);
      return data;
  }
}

async function executeGPTTask(node: WorkflowNode, data: Record<string, unknown>): Promise<unknown> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }

    const config = node.data.config || {};
    console.log(`🧠 GPT Task executing with resolved config:`, JSON.stringify(config, null, 2));

    // Call the dedicated gpt-task edge function with resolved configuration
    const response = await fetch(`${supabaseUrl}/functions/v1/gpt-task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: config,
        inputs: data // Pass the workflow data as inputs for any remaining parameter substitution
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GPT Task function error:', errorText);
      throw new Error(`GPT Task function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    console.log(`🧠 GPT Task completed. Response: ${result.result?.substring(0, 50)}...`);

    return {
      result: result.result,
      usage: result.usage,
      model: result.model
    };

  } catch (error) {
    console.error('GPT task error:', error);
    const err = ensureError(error);
    return {
      error: err.message,
      result: null
    };
  }
}

async function executeHTTPTask(node: WorkflowNode, data: Record<string, unknown>): Promise<unknown> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }

    const config = (node.data.config as Record<string, unknown>) || {};
    console.log(`🌐 HTTP Task executing with resolved config:`, JSON.stringify(config, null, 2));
    console.log(`🌐 Available data for parameter replacement:`, Object.keys(data));
    
    // Config should already be resolved from main workflow processing
    const resolvedConfig = config;

    // Call the dedicated http-task edge function with resolved configuration
    const response = await fetch(`${supabaseUrl}/functions/v1/http-task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: resolvedConfig
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP Task function error:', errorText);
      throw new Error(`HTTP Task function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`🌐 HTTP Task result from edge function:`, result);

    // Return the result with proper structure for reference by other nodes
    return {
      ...data,
      response: (result as any).body,  // This is what {{HTTP 1.response}} should reference
      http_response: (result as any).body,
      http_status: (result as any).status,
      http_success: (result as any).success,
      request_url: (resolvedConfig as any).url,
      request_method: (resolvedConfig as any).method,
      request_body: (resolvedConfig as any).body,
      request_headers: (resolvedConfig as any).headers,
      full_result: result // Store the complete result for debugging
    };

  } catch (error) {
    console.error('🚨 HTTP task error:', error);
    const err = ensureError(error);
    return {
      ...data,
      http_error: err.message,
      http_success: false,
      response: null
    };
  }
}

async function executeConditional(node: WorkflowNode, data: Record<string, unknown>): Promise<unknown> {
  // Simple conditional logic - could be expanded
  const { condition, trueValue, falseValue } = (node.data.config as any) || {};
  
  // Basic condition evaluation (you could make this more sophisticated)
  let conditionResult = false;
  if (condition && typeof data === 'object') {
    // Simple key existence check
    conditionResult = Object.keys(data).some(key => condition.includes(key));
  }

  return {
    ...data,
    condition_result: conditionResult,
    condition_value: conditionResult ? trueValue : falseValue
  };
}

async function executeDataTransform(node: WorkflowNode, data: Record<string, unknown>): Promise<unknown> {
  try {
    const { transformations } = (node.data.config as any) || {};
    const transformedData = { ...data };

    if (transformations && Array.isArray(transformations)) {
        transformations.forEach((transform: { operation: string; field: string; value: unknown }) => {
        const { operation, field, value } = transform;
        
        switch (operation) {
          case 'add':
            transformedData[field] = value;
            break;
          case 'remove':
            delete transformedData[field];
            break;
          case 'modify':
            if (transformedData[field] !== undefined) {
              transformedData[field] = value;
            }
            break;
        }
      });
    }

    return transformedData;

  } catch (error) {
    console.error('Data transform error:', error);
    const err = ensureError(error);
    return {
      ...data,
      transform_error: err.message
    };
  }
}

async function executeWebhookResponse(node: WorkflowNode, data: Record<string, unknown>): Promise<unknown> {
  // Parse config if it's a string (which it often is)
  let config = node.data.config || {};
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (error) {
      console.error('Failed to parse webhook response config:', error);
      config = {};
    }
  }
  
  const { statusCode = 200, responseBody, headers = {} } = (config as any);
  
  console.log(`📤 Webhook Response executed with status: ${statusCode}`);
  console.log(`📤 Raw response body from config:`, responseBody);
  
  // If no response body is configured, return an error
  if (responseBody === undefined || responseBody === null || responseBody === '') {
    throw new Error('Webhook response node requires a configured response body');
  }
  
  // Process the response body to replace any remaining parameters
  let processedResponseBody = responseBody;
  
  // Process for parameter replacement based on type
  if (typeof processedResponseBody === 'string') {
    // For strings, first try to parse as JSON to get the object structure
    let bodyAsObject;
    try {
      bodyAsObject = JSON.parse(processedResponseBody);
      // If successful, process the object and then convert back to JSON
      processedResponseBody = replaceParameters(bodyAsObject, data);
    } catch (error) {
      // If not valid JSON, process as string directly
      console.log('Response body is not valid JSON, processing as string');
      processedResponseBody = replaceParameters(processedResponseBody, data);
    }
  } else if (typeof processedResponseBody === 'object') {
    // If it's already an object, process it for parameter replacement
    processedResponseBody = replaceParameters(processedResponseBody, data);
  }
  
  console.log(`📤 Final processed response body:`, JSON.stringify(processedResponseBody).substring(0, 200) + '...');
  
  // Return only the configured response body, not accumulated workflow data
  const result: Record<string, unknown> = {
    webhook_response: {
      statusCode,
      body: processedResponseBody,
      headers
    },
    result: processedResponseBody,
    message: `Webhook response sent with status ${statusCode}`,
    executedAt: new Date().toISOString()
  };
  
  console.log(`✅ Webhook Response completed successfully`);
  return result;
}

async function executeRouter(node: WorkflowNode, data: Record<string, unknown>): Promise<unknown> {
  console.log(`🔀 Router node executing with config:`, node.data.config);
  
  // Router node just passes data through - the parallel execution logic
  // is handled in the main workflow processing where we process multiple edges
  return data;
}
