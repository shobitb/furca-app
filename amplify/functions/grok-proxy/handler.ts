// @ts-ignore
import OpenAI from 'openai';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
// @ts-ignore
import { env } from '$amplify/env/grok-proxy';

const awslambda = (global as any).awslambda;

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    const { messages } = JSON.parse(event.body || '{}');

    // Initialize the SDK inside the handler
    const grok = new OpenAI({
      apiKey: env.GROK_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });

    // Set stream metadata immediately
    const metadata = {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    };
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      const stream = await grok.chat.completions.create({
        model: 'grok-4',
        messages,
        stream: true,
      });

      // SDK will handle SSE
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          // Send ONLY the text signal to the frontend
          responseStream.write(content);
        }
      }
    } catch (error) {
      console.error("Grok SDK Error:", error);
    } finally {
      responseStream.end();
    }
  }
);