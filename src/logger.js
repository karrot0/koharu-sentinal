const write = (level, message) => {
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  if (level === 'ERROR') console.error(line);
  else console.log(line);
};

export const log = Object.freeze({
  info: (message) => write('INFO', message),
  warn: (message) => write('WARN', message),
  error: (message, error) => write('ERROR', error ? `${message}: ${error.stack ?? error}` : message),
});
