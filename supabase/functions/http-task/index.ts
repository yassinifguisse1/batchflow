import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract URL from various JSON structures
function extractUrlFromJson(jsonObj: any): string | null {
  if (!jsonObj) return null;
  
  // Common patterns for URL extraction
  const urlPatterns = [
    // Direct url property
    'url',
    // OpenAI-style response
    'data.0.url',
    'data.0.revised_prompt', 
    // Other common patterns
    'image_url',
    'link',
    'download_url',
    'file_url',
    'result.url',
    'response.url'
  ];
  
  for (const pattern of urlPatterns) {
    const url = getNestedProperty(jsonObj, pattern);
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      console.log(`Found URL using pattern '${pattern}':`, url);
      return url;
    }
  }
  
  // If no pattern matches, recursively search for any URL-like string
  const foundUrl = findUrlInObject(jsonObj);
  if (foundUrl) {
    console.log('Found URL through recursive search:', foundUrl);
    return foundUrl;
  }
  
  return null;
}

// Helper to get nested property using dot notation
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      // Handle array indices
      if (!isNaN(Number(key))) {
        return current[Number(key)];
      }
      return current[key];
    }
    return undefined;
  }, obj);
}

// Recursively search for URL-like strings in an object
function findUrlInObject(obj: any): string | null {
  if (typeof obj === 'string') {
    if (obj.startsWith('http://') || obj.startsWith('https://')) {
      return obj;
    }
    return null;
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findUrlInObject(item);
      if (found) return found;
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const value of Object.values(obj)) {
      const found = findUrlInObject(value);
      if (found) return found;
    }
  }
  
  return null;
}

serve(async (req) => {
  console.log('🚀 HTTP Task handler called!');
  console.log('Method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config } = await req.json();
    console.log('HTTP Task config:', config);

    if (!config || !config.url) {
      return new Response(
        JSON.stringify({ error: 'Missing URL in config' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare headers
    let headers: Record<string, string> = {};

    // Set Content-Type based on config
    if (config.contentType) {
      if (config.contentType !== 'multipart/form-data') {
        headers['Content-Type'] = config.contentType;
      }
      // For multipart/form-data, let the browser set the Content-Type with boundary
    } else {
      headers['Content-Type'] = 'application/json';
    }

    if (config.headers) {
      try {
        const parsedHeaders = typeof config.headers === 'string' 
          ? JSON.parse(config.headers) 
          : config.headers;
        headers = { ...headers, ...parsedHeaders };
      } catch (e) {
        console.log('Failed to parse headers, using defaults:', e);
      }
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method: config.method || 'GET',
      headers
    };

    // Add body for non-GET requests
    if (config.method !== 'GET' && config.body) {
      if (config.contentType === 'multipart/form-data') {
        // Parse form data format (key=value pairs)
        const formData = new FormData();
        const lines = config.body.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            const [key, ...valueParts] = trimmedLine.split('=');
            const value = valueParts.join('=');
            if (key && value) {
              formData.append(key.trim(), value.trim());
            }
          }
        }
        requestOptions.body = formData;
        // Remove Content-Type header for FormData - browser will set it with boundary
        delete headers['Content-Type'];
      } else {
        requestOptions.body = config.body;
      }
    }

    console.log('Making HTTP request to:', config.url);
    console.log('Request options:', requestOptions);

    // Make the HTTP request
    const response = await fetch(config.url, requestOptions);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Get response body - clone response to avoid "Body already consumed" error
    let responseBody;
    const contentType = response.headers.get('content-type') || '';
    
    try {
      // Always get text first, then parse as JSON if needed
      const textBody = await response.text();
      
      if (contentType.includes('application/json') && textBody.trim()) {
        try {
          responseBody = JSON.parse(textBody);
        } catch (e) {
          console.log('Failed to parse JSON, using text response:', e);
          responseBody = textBody;
        }
      } else {
        responseBody = textBody;
      }
    } catch (e) {
      console.error('Failed to read response body:', e);
      responseBody = null;
    }

    console.log('Response body:', responseBody);

    // Enhanced URL extraction logic
    let extractedUrl = null;
    let parsedResponse = responseBody;

    // Try to extract URL from different response formats
    if (typeof responseBody === 'string') {
      // Check if it's a direct URL
      if (responseBody.startsWith('http://') || responseBody.startsWith('https://')) {
        extractedUrl = responseBody.trim();
        console.log('Direct URL detected:', extractedUrl);
      } else {
        // Try to parse as JSON in case content-type was wrong
        try {
          const jsonResponse = JSON.parse(responseBody);
          extractedUrl = extractUrlFromJson(jsonResponse);
          parsedResponse = jsonResponse;
        } catch (e) {
          console.log('Not a JSON string, keeping as text');
        }
      }
    } else if (typeof responseBody === 'object' && responseBody !== null) {
      // It's already parsed JSON
      extractedUrl = extractUrlFromJson(responseBody);
      parsedResponse = responseBody;
    }

    console.log('Extracted URL:', extractedUrl);

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: extractedUrl || parsedResponse, // Use extracted URL as primary response if available
      response: extractedUrl || parsedResponse, // Also include as 'response' for consistent workflow access
      extractedUrl: extractedUrl, // Add the extracted URL for easy access
      fullResponse: parsedResponse, // Keep the full response for advanced use cases
      success: response.ok
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('HTTP Task error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'HTTP request failed',
        message: error.message,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});