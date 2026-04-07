/**
 * 404 handler — catches requests that matched no route.
 * Must be registered after all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

/**
 * Global error handler — catches anything passed to next(err).
 * Must be registered last (4-argument signature required by Express).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Preserve explicit status codes set on the error object
  const status = err.statusCode || err.status || 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${req.method} ${req.path}]`, err);
  } else if (status >= 500) {
    // Log only server errors in production
    console.error(err);
  }

  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && status >= 500 && { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, errorHandler };