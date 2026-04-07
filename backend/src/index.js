const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./sockets/quiz.socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

initSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});