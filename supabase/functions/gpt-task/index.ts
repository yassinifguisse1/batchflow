import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config, inputs } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build messages array
    const messages = [];
    
    // Add system message if provided
    if (config.systemMessage) {
      messages.push({
        role: 'system',
        content: config.systemMessage
      });
    }

    // Add user prompt (replace any parameter placeholders with actual values)
    let prompt = config.prompt || '';
    if (inputs) {
      // Create a comprehensive flattened inputs object
      const flatInputs = {};
      
      // First, add all the raw input data at the top level
      Object.keys(inputs).forEach(nodeKey => {
        const nodeData = inputs[nodeKey];
        
        if (nodeData && typeof nodeData === 'object') {
          // Handle different data structures that can contain the actual values
          
          // Case 1: Direct data properties (for trigger nodes)
          if (nodeData.data && typeof nodeData.data === 'object') {
            Object.keys(nodeData.data).forEach(dataKey => {
              flatInputs[`${nodeKey}.${dataKey}`] = nodeData.data[dataKey];
            });
          }
          
          // Case 2: Body properties (for webhook data)
          if (nodeData.body && typeof nodeData.body === 'object') {
            Object.keys(nodeData.body).forEach(bodyKey => {
              flatInputs[`${nodeKey}.${bodyKey}`] = nodeData.body[bodyKey];
            });
          }
          
          // Case 3: Direct properties on the node
          Object.keys(nodeData).forEach(key => {
            if (key !== 'data' && key !== 'body' && nodeData[key] !== null && nodeData[key] !== undefined) {
              flatInputs[`${nodeKey}.${key}`] = nodeData[key];
            }
          });
          
          // Case 4: Nested trigger data (handle "Trigger 1" inside "Trigger 1")
          if (nodeData[nodeKey] && typeof nodeData[nodeKey] === 'object') {
            Object.keys(nodeData[nodeKey]).forEach(nestedKey => {
              if (nodeData[nodeKey][nestedKey] !== null && nodeData[nodeKey][nestedKey] !== undefined) {
                flatInputs[`${nodeKey}.${nestedKey}`] = nodeData[nodeKey][nestedKey];
              }
            });
          }
        }
      });

      console.log('Parameter replacement debug:', {
        originalPrompt: config.prompt,
        availableParams: Object.keys(flatInputs),
        inputStructure: inputs
      });

      // Replace all parameter patterns with more comprehensive matching
      Object.keys(flatInputs).forEach(key => {
        // Create multiple regex patterns to catch different parameter formats
        const patterns = [
          new RegExp(`{{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g'),
          new RegExp(`{{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}}}`, 'g')
        ];
        
        let value = flatInputs[key];
        
        // If the value is an object or array, stringify it for better readability
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value, null, 2);
        } else if (value === null || value === undefined) {
          value = '';
        } else {
          value = String(value);
        }
        
        patterns.forEach(regex => {
          prompt = prompt.replace(regex, value);
        });
      });

      console.log('Final processed prompt:', prompt);
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    // Prepare OpenAI request payload
    const selectedModel = config.model || 'gpt-4o-mini';
    const openAIPayload = {
      model: selectedModel,
      messages,
      top_p: config.top_p || 1,
      stream: config.stream || false
    };

    // Handle max tokens parameter - newer models use max_completion_tokens
    const isNewerModel = selectedModel.includes('gpt-5') || 
                        selectedModel.includes('gpt-4.1') || 
                        selectedModel.includes('o3') || 
                        selectedModel.includes('o4');
    
    const maxTokens = config.max_tokens || 150;
    if (isNewerModel) {
      openAIPayload.max_completion_tokens = maxTokens;
      // Newer models don't support temperature parameter
    } else {
      openAIPayload.max_tokens = maxTokens;
      openAIPayload.temperature = config.temperature || 0.7;
    }

    // Add response format if JSON mode is enabled
    if (config.response_format?.type === 'json_object') {
      openAIPayload.response_format = { type: 'json_object' };
    }

    // Check prompt length to prevent token limit issues
    const promptLength = prompt.length;
    const estimatedTokens = Math.ceil(promptLength / 4); // Rough estimate: 1 token ≈ 4 characters
    
    console.log('GPT Task Debug Info:', {
      model: openAIPayload.model,
      messageCount: messages.length,
      maxTokens: openAIPayload.max_tokens || openAIPayload.max_completion_tokens,
      maxTokensParam: isNewerModel ? 'max_completion_tokens' : 'max_tokens',
      configuredMaxTokens: config.max_tokens,
      isNewerModel: isNewerModel,
      promptLength: promptLength,
      estimatedTokens: estimatedTokens,
      originalPrompt: config.prompt?.substring(0, 200) + (config.prompt?.length > 200 ? '...' : ''),
      processedPrompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
      inputs: inputs ? Object.keys(inputs) : 'no inputs'
    });

    // Warn if prompt might be too long
    if (estimatedTokens > 15000) {
      console.warn(`⚠️ Large prompt detected: ${estimatedTokens} estimated tokens. This might cause issues.`);
    }

    // Add timeout and retry logic for OpenAI API with longer timeout for large prompts
    const fetchWithTimeout = async (url, options, timeoutMs = 90000, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`GPT API attempt ${attempt}/${maxRetries}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          console.error(`GPT API attempt ${attempt} failed:`, error.message);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    };

    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log('OpenAI response received:', {
      usage: data.usage,
      resultLength: result?.length
    });

    return new Response(JSON.stringify({ 
      result,
      usage: data.usage,
      model: data.model
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-task function:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
      type: error.name,
      details: error.cause ? error.cause.toString() : 'No additional details'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});