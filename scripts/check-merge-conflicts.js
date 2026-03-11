#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  const out = execSync(
    "rg -n '^(<<<<<<<|>>>>>>>|=======$)' --glob '!node_modules/**' --glob '!.next/**'",
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();

  if (out) {
    console.error('❌ Merge conflict markers encontrados:');
    console.error(out);
    process.exit(1);
  }

  console.log('✅ Nenhum merge conflict marker encontrado.');
} catch (err) {
  // rg exit code 1 => nenhum match (sucesso para este check)
  if (typeof err.status === 'number' && err.status === 1) {
    console.log('✅ Nenhum merge conflict marker encontrado.');
    process.exit(0);
  }

  console.error('❌ Falha ao executar verificação de merge conflicts.');
  if (err.stdout) process.stderr.write(String(err.stdout));
  if (err.stderr) process.stderr.write(String(err.stderr));
  process.exit(2);
}
