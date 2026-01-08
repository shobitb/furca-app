import { defineFunction, secret } from '@aws-amplify/backend';

export const grokProxy = defineFunction({
  name: 'grok-proxy',
  entry: './handler.ts',
  environment: {
    GROK_API_KEY: secret('GROK_API_KEY')
  },
  timeoutSeconds: 60,
});
