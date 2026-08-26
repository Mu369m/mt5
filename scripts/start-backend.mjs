// Railway backend entrypoint: deploy committed Prisma migrations, then start compiled Express/WebSocket server.
import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = ['--filter', '@workspace/backend', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'];

const migration = spawn(command, args, { stdio: 'inherit', shell: false });
migration.on('exit', (code, signal) => {
  if (signal || code !== 0) process.exit(code ?? 1);
  const server = spawn(process.execPath, ['backend/dist/backend/src/server.js'], { stdio: 'inherit', env: process.env });
  server.on('exit', (serverCode, serverSignal) => process.exit(serverCode ?? (serverSignal ? 1 : 0)));
});
