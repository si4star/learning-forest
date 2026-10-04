import { handle } from '../../src/server/api.js';

export const onRequest = ({ request, env }) => handle(request, env);
