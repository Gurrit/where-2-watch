import { buildApp } from './app.js';
import { config } from './config.js';

await buildApp().listen({ port: config.port, host: config.host });
