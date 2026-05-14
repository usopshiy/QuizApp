/**
 * Нагрузочный тест для quiz-platform
 * Использование:
 *   node load-test.js --users 10 --code ABCDEF
 */

const { io }   = require('socket.io-client');
const args     = process.argv.slice(2);

// ── Параметры из командной строки ────────────────────────────
const NUM_USERS = parseInt(args[args.indexOf('--users') + 1]) || 10;
const JOIN_CODE = args[args.indexOf('--code')  + 1] || 'ABCDEF';
const SERVER    = 'http://localhost:3000';

// ── Статистика ───────────────────────────────────────────────
const stats = {
  connected:    0,
  joined:       0,
  answered:     0,
  errors:       0,
  connectTimes: [],   // время до успешного join (мс)
  answerTimes:  [],   // задержка answer:received (мс)
};

console.log(`\n🚀 Запуск нагрузочного теста`);
console.log(`   Участников: ${NUM_USERS}`);
console.log(`   Код комнаты: ${JOIN_CODE}`);
console.log(`   Сервер: ${SERVER}\n`);

// ── Запуск виртуальных участников ────────────────────────────
for (let i = 0; i < NUM_USERS; i++) {
  // Небольшая задержка между подключениями чтобы не перегрузить сервер моментальным подключением большого числа пользователей
  setTimeout(() => spawnParticipant(i), (i / 5) * 100);
}

function spawnParticipant(index) {
  const displayName  = `LoadUser_${index}_${Date.now()}`;

  let sessionId  = null;
  let questionId = null;
  let optionId   = null;
  let answerSent = false;
  let answerSentAt = null;

  const socket = io(SERVER, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 10000,
  });

  socket.on('connect', () => {
    stats.connected++;
    logProgress();
    сonnectStart = Date.now();
    // Подключаемся к сессии
    socket.emit('participant:join', {
      joinCode:    JOIN_CODE,
      displayName: displayName,
    });
  });

  socket.on('connect_error', (err) => {
    stats.errors++;
    console.error(`❌ [${index}] Ошибка подключения: ${err.message}`);
  });

  // Подтверждение входа в сессию
  socket.on('session:participantJoined', (data) => {
    if (data.participant?.display_name !== displayName) return;

    sessionId = data.sessionId;
    const joinTime = Date.now() - connectStart;
    stats.joined++;
    stats.connectTimes.push(joinTime);
    logProgress();
  });

  // Получение вопроса — отправляем ответ
  socket.on('session:question', (data) => {
    if (answerSent) return;

    questionId = data.question?.id;
    optionId   = data.question?.options?.[0]?.id;

    if (!sessionId || !questionId || !optionId) {
      stats.errors++;
      return;
    }

    // Случайная задержка 1-10 сек имитирует обдумывание
    const thinkTime = 1000 + Math.random() * 9000;

    setTimeout(() => {
      answerSentAt = Date.now();
      answerSent   = true;

      socket.emit('participant:answer', {
        sessionId,
        questionId,
        optionIds: [optionId],
      });
    }, thinkTime);
  });

  // Подтверждение ответа — замеряем задержку
  socket.on('answer:received', () => {
    if (answerSentAt) {
      const latency = Date.now() - answerSentAt;
      stats.answerTimes.push(latency);
    }
    stats.answered++;
    logProgress();
  });

  // Конец сессии — отключаемся
  socket.on('session:ended', () => {
    socket.disconnect();
    if (stats.answered === NUM_USERS) {
      printResults();
    }
  });

  socket.on('error', (err) => {
    stats.errors++;
    console.error(`❌ [${index}] Ошибка: ${err.message}`);
  });

  socket.on('disconnect', () => {
    // Если не ответили — считаем как ошибку
    if (!answerSent) {
      stats.errors++;
    }
  });
}

// ── Вывод прогресса ──────────────────────────────────────────
function logProgress() {
  process.stdout.write(
    `\r   Подключено: ${stats.connected}/${NUM_USERS} | ` +
    `В сессии: ${stats.joined}/${NUM_USERS} | ` +
    `Ответили: ${stats.answered}/${NUM_USERS} | ` +
    `Ошибки: ${stats.errors}`
  );
}

// ── Итоговый отчёт ───────────────────────────────────────────
function printResults() {
  console.log('\n\n═══════════════════════════════════════════');
  console.log('           РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТА    ');
  console.log('═══════════════════════════════════════════\n');

  console.log(`Количество участников:  ${NUM_USERS}`);
  console.log(`Успешно подключились:   ${stats.joined}`);
  console.log(`Успешно ответили:       ${stats.answered}`);
  console.log(`Ошибки:                 ${stats.errors}`);

  if (stats.connectTimes.length) {
    console.log(`\n── Время подключения к сессии (мс) ─────────`);
    console.log(`   Мин:     ${Math.min(...stats.connectTimes)}`);
    console.log(`   Макс:    ${Math.max(...stats.connectTimes)}`);
    console.log(`   Среднее: ${avg(stats.connectTimes)}`);
    console.log(`   P95:     ${percentile(stats.connectTimes, 95)}`);
  }

  if (stats.answerTimes.length) {
    console.log(`\n── Задержка доставки ответа (мс) ───────────`);
    console.log(`   Мин:     ${Math.min(...stats.answerTimes)}`);
    console.log(`   Макс:    ${Math.max(...stats.answerTimes)}`);
    console.log(`   Среднее: ${avg(stats.answerTimes)}`);
    console.log(`   P95:     ${percentile(stats.answerTimes, 95)}`);
  }

  console.log('\n═══════════════════════════════════════════\n');
  process.exit(0);
}

// ── Завершение по таймауту если сессия не закончилась ────────
setTimeout(() => {
  console.log('\n\n⏱ Таймаут — принудительное завершение теста');
  printResults();
}, 120000);

// ── Вспомогательные функции ──────────────────────────────────
function avg(arr) {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx    = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx];
}
