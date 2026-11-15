#!/usr/bin/env node
import { main } from './cli';

main(process.argv.slice(2)).then(
  (code) => {
    // `mustlist mcp` keeps running on stdin; other commands exit with their code.
    if (code !== 0) process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`mustlist: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
