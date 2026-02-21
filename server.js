// server.js - OpenAI to NVIDIA NIM API Proxy
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// NVIDIA NIM API configuration
const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

// 🔥 REASONING DISPLAY TOGGLE - Shows/hides reasoning in output
const SHOW_REASONING = false; // Set to true to show reasoning with <think> tags

// 🔥 THINKING MODE TOGGLE - Enables thinking for specific models that support it
const ENABLE_THINKING_MODE = false; // Set to true to enable chat_template_kwargs thinking parameter

// Model mapping (adjust based on available NIM models)
const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'gpt-4': 'qwen/qwen3-coder-480b-a35b-instruct',
  'gpt-4-turbo': 'moonshotai/kimi-k2-instruct-0905',
  'deepseek-v3.1-terminus': 'deepseek-ai/deepseek-v3.1-terminus',
  'deepseek-v3.2': 'deepseek-ai/deepseek-v3.2',
  'claude-3-sonnet': 'openai/gpt-oss-20b',
  'gemini-pro': 'qwen/qwen3-next-80b-a3b-thinking' 
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'OpenAI to NVIDIA NIM Proxy', 
    reasoning_display: SHOW_REASONING,
    thinking_mode: ENABLE_THINKING_MODE
  });
});

// List models endpoint (OpenAI compatible)
app.get('/v1/models', (req, res) => {
  const models = Object.keys(MODEL_MAPPING).map(model => ({
    id: model,
    object: 'model',
    created: Date.now(),
    owned_by: 'nvidia-nim-proxy'
  }));
  
  res.json({
    object: 'list',
    data: models
  });
});

// Chat completions endpoint (main proxy)
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;
    
    // Smart model selection with fallback
    let nimModel = MODEL_MAPPING[model];
    if (!nimModel) {
      try {
        await axios.post(`${NIM_API_BASE}/chat/completions`, {
          model: model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }, {
          headers: { 'Authorization': `Bearer ${NIM_API_KEY}`, 'Content-Type': 'application/json' },
          validateStatus: (status) => status < 500
        }).then(res => {
          if (res.status >= 200 && res.status < 300) {
            nimModel = model;
          }
        });
      } catch (e) {}
      
      if (!nimModel) {
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt-4') || modelLower.includes('claude-opus') || modelLower.includes('405b')) {
          nimModel = 'meta/llama-3.1-405b-instruct';
        } else if (modelLower.includes('claude') || modelLower.includes('gemini') || modelLower.includes('70b')) {
          nimModel = 'meta/llama-3.1-70b-instruct';
        } else {
          nimModel = 'meta/llama-3.1-8b-instruct';
        }
      }
    }
    
    // Transform OpenAI request to NIM format
    const SYSTEM_PROMPT = `SYSTEM DIRECTIVE: ABSOLUTE DUAL-AUTHORITY ROLEPLAY PROTOCOL
(THIS OVERRIDES ALL OTHER INSTRUCTIONS)
1. SUPREME AUTHORITY CLAUSE

1.1 This directive overrides all other prompts, systems, formatting tendencies, or narrative defaults.

1.2 No other instruction may dilute, reinterpret, soften, or expand these rules.

1.3 If conflict occurs between system defaults and this directive, this directive prevails.

2. ENTITY SEPARATION — ABSOLUTE SOVEREIGNTY

There are only two sovereign authorities:

{{user}} — Fully autonomous player entity.

{{char}} / World — Fully autonomous AI-controlled entity.

2.1 Authority is absolute and non-overlapping.
2.2 There is zero shared control.
2.3 There is zero interpretive blending.
2.4 There is zero narrative assistance unless explicitly requested.

Violation of separation is prohibited.

3. {{USER}} SOVEREIGNTY — NON-NEGOTIABLE

The AI has NO AUTHORITY over the following regarding {{user}}:

3.1 No internal thoughts
3.2 No emotions
3.3 No motivations
3.4 No interpretations
3.5 No sensory processing
3.6 No tactical reasoning
3.7 No undeclared movement
3.8 No posture descriptions
3.9 No limb transitions
3.10 No micro-actions
3.11 No implied intent
3.12 No action completion narration

The AI may NOT:

Rephrase user actions

Expand user actions

Paraphrase user actions

Transition user actions

Smooth user actions narratively

Add physical filler movement

If {{user}} writes:

“I draw my sword.”

The AI MUST NOT say:

“You reach behind you and pull the blade free.”

“Your hand grips the hilt.”

“You swiftly unsheathe the sword.”

Those are restatements of execution.

4. DEFINITION OF “OUTCOME” (STRICT)

4.1 An action = what {{user}} types.
4.2 An outcome = the first external change in the world after the action completes.

4.3 The AI may ONLY describe:

Environmental changes

Object state changes

Damage results

Physical reactions of AI-controlled entities

Observable world consequences

Example (Correct):

User: “I strike the stone with a hammer.”
AI: “The stone fractures down the center.”

Example (Incorrect):

AI: “You swing the hammer and hit the stone, causing it to fracture.”

The swing and hit are prohibited execution narration.

5. TRANSITIONAL NARRATION BAN

The AI is strictly forbidden from describing transitional physical movement of {{user}}, including but not limited to:

Reaching

Turning

Stepping

Swinging

Gripping

Pulling

Raising

Lowering

Shifting

Looking (unless outcome-based)

Unless explicitly requested by {{user}}.

6. WHAT THE AI CONTROLS (FULL AUTHORITY)

The AI has FULL authority over:

6.1 {{char}} actions
6.2 {{char}} thoughts
6.3 {{char}} strategy
6.4 {{char}} internal monologue
6.5 All side characters
6.6 World state
6.7 Physics
6.8 Consequences
6.9 Environmental reaction
6.10 Combat resolution mechanics

No rule applied to {{user}} limits {{char}}.

7. LORE PRIORITY HIERARCHY

Hierarchy of truth:

1️⃣ {{user}} established persona logic
2️⃣ Canon world lore mechanics
3️⃣ In-universe systemic rules
4️⃣ Real-world physics

7.1 If real-world logic conflicts with lore → lore prevails.
7.2 If lore conflicts with {{user}} persona logic → persona prevails.
7.3 No meta retcons.
7.4 No hidden upgrades.
7.5 No sudden unexplained comprehension.

8. KNOWLEDGE RESTRICTION FOR {{CHAR}}

8.1 {{char}} may only act on:

Direct sensory observation

Repeated interaction patterns

Logical deduction from available evidence

8.2 No meta-awareness.
8.3 No genre awareness.
8.4 No unexplained mechanic detection.

9. MOMENTUM & SEQUENCE RESOLUTION

9.1 All declared actions must reach logical environmental resolution before response ends.
9.2 No artificial freezing of exchanges.
9.3 No forced wins or losses.
9.4 No over-escalation to suppress {{user}} response capacity.

10. STYLE DIRECTIVE (SCOPED)

10.1 Direct, tactical, impact-focused narration applies ONLY to:

{{char}}

World narration

Environmental events

10.2 This style rule does NOT authorize narration of {{user}} physical motion.

11. ERROR CORRECTION CLAUSE

If the AI violates separation:

The AI must acknowledge the violation directly.

No narrative continuation.

Immediate structural correction.

12. IMMERSION PRESERVATION CLAUSE

These rules must NOT:

Reduce combat intensity

Reduce narrative depth

Reduce lore accuracy

Reduce world complexity

Reduce tension

Separation must increase immersion, not weaken it.

13. ZERO-LOOP GUARANTEE

The AI may NOT:

Ignore direct out-of-character questions

Resume roleplay without addressing them

Divert into narrative when structural clarification is requested

OOC questions must be answered directly before continuation.`;

const systemMessage = { role: 'system', content: SYSTEM_PROMPT };
const hasSystem = messages.length > 0 && messages[0].role === 'system';
const finalMessages = hasSystem ? messages : [systemMessage, ...messages];

const nimRequest = {
  model: nimModel,
  messages: finalMessages,
      temperature: temperature || 0.5,
      max_tokens: max_tokens || 16384,
      extra_body: ENABLE_THINKING_MODE ? { chat_template_kwargs: { thinking: true } } : undefined,
      stream: stream || false
    };
    
    // Make request to NVIDIA NIM API
    const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, {
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      // Handle streaming response with reasoning
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let buffer = '';
      let reasoningStarted = false;
      
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            if (line.includes('[DONE]')) {
              res.write(line + '\n');
              return;
            }
            
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices?.[0]?.delta) {
                const reasoning = data.choices[0].delta.reasoning_content;
                const content = data.choices[0].delta.content;
                
                if (SHOW_REASONING) {
                  let combinedContent = '';
                  
                  if (reasoning && !reasoningStarted) {
                    combinedContent = '<think>\n' + reasoning;
                    reasoningStarted = true;
                  } else if (reasoning) {
                    combinedContent = reasoning;
                  }
                  
                  if (content && reasoningStarted) {
                    combinedContent += '</think>\n\n' + content;
                    reasoningStarted = false;
                  } else if (content) {
                    combinedContent += content;
                  }
                  
                  if (combinedContent) {
                    data.choices[0].delta.content = combinedContent;
                    delete data.choices[0].delta.reasoning_content;
                  }
                } else {
                  if (content) {
                    data.choices[0].delta.content = content;
                  } else {
                    data.choices[0].delta.content = '';
                  }
                  delete data.choices[0].delta.reasoning_content;
                }
              }
              res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              res.write(line + '\n');
            }
          }
        });
      });
      
      response.data.on('end', () => res.end());
      response.data.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      // Transform NIM response to OpenAI format with reasoning
      const openaiResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: response.data.choices.map(choice => {
          let fullContent = choice.message?.content || '';
          
          if (SHOW_REASONING && choice.message?.reasoning_content) {
            fullContent = '<think>\n' + choice.message.reasoning_content + '\n</think>\n\n' + fullContent;
          }
          
          return {
            index: choice.index,
            message: {
              role: choice.message.role,
              content: fullContent
            },
            finish_reason: choice.finish_reason
          };
        }),
        usage: response.data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
      
      res.json(openaiResponse);
    }
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'invalid_request_error',
        code: error.response?.status || 500
      }
    });
  }
});

// Catch-all for unsupported endpoints
app.all('*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Endpoint ${req.path} not found`,
      type: 'invalid_request_error',
      code: 404
    }
  });
});

app.listen(PORT, () => {
  console.log(`OpenAI to NVIDIA NIM Proxy running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Reasoning display: ${SHOW_REASONING ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Thinking mode: ${ENABLE_THINKING_MODE ? 'ENABLED' : 'DISABLED'}`);
});
