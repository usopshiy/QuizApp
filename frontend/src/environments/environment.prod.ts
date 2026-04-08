export const environment = {
  production: true,
  // In production the frontend is served by nginx on the same origin,
  // so relative URLs work — the nginx proxy forwards /api and /socket.io
  // to the backend container. Change these if deploying separately.
  apiUrl:    '/api',
  socketUrl: '',
};