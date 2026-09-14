const [environment, target] = process.argv.slice(2);
const environments = new Set(["development", "staging", "production"]);
const targets = {
  server: "../src/server.js",
  worker: "../src/workers/outbox.worker.js",
};

if (!environments.has(environment) || !targets[target]) {
  console.error(
    "Usage: node scripts/run-environment.js <development|staging|production> <server|worker>",
  );
  process.exit(1);
}

process.env.NODE_ENV = environment;
await import(targets[target]);
