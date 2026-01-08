import { defineBackend } from '@aws-amplify/backend';
import { grokProxy } from './functions/grok-proxy/resource';
import { FunctionUrlAuthType, InvokeMode, HttpMethod } from 'aws-cdk-lib/aws-lambda';

const backend = defineBackend({
  grokProxy,
});

// 1. Get a reference to the underlying Lambda resource
const grokLambda = backend.grokProxy.resources.lambda;

// 2. Add the Function URL
const funcUrl = grokLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE, // Set to NONE for public access
  invokeMode: InvokeMode.RESPONSE_STREAM,
  cors: {
    allowedOrigins: ['*'], // In production, replace '*' with your actual domain
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['content-type'],
  },
});

// 3. Optional: Export the URL so it shows up in your terminal outputs
backend.addOutput({
  custom: {
    grokProxyUrl: funcUrl.url,
  },
});