import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capturedImage, storedImageUrl } = await req.json();

    if (!capturedImage || !storedImageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing capturedImage or storedImageUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting face verification...');

    // Use Gemini Flash for multimodal face comparison
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a face verification AI. Compare two photos and determine if they show the same person.
            
IMPORTANT RULES:
- Focus on facial features: face shape, eyes, nose, mouth, eyebrows
- Ignore differences in lighting, angle, expression, clothing, background
- Be somewhat lenient since the captured photo is from a webcam
- Return ONLY a JSON object with two fields:
  - "match": boolean (true if same person, false otherwise)
  - "confidence": number from 0-100 representing how confident you are
  
Example response: {"match": true, "confidence": 85}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Compare these two photos and determine if they show the same person. The first image is the stored profile photo, the second is the live capture from a webcam.'
              },
              {
                type: 'image_url',
                image_url: { url: storedImageUrl }
              },
              {
                type: 'image_url',
                image_url: { url: capturedImage }
              }
            ]
          }
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);

    // Parse the AI response
    let matchScore = 0;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.match === true) {
          matchScore = parsed.confidence || 80;
        } else {
          matchScore = 100 - (parsed.confidence || 80);
        }
      } else {
        // Fallback: look for keywords
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('same person') || lowerContent.includes('match')) {
          matchScore = 80;
        } else if (lowerContent.includes('different') || lowerContent.includes('not the same')) {
          matchScore = 30;
        } else {
          matchScore = 50; // Uncertain
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      matchScore = 50;
    }

    console.log('Final match score:', matchScore);

    return new Response(
      JSON.stringify({ 
        matchScore,
        verified: matchScore >= 70,
        message: matchScore >= 70 ? 'Face verified successfully' : 'Face verification failed'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Face verification failed', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});