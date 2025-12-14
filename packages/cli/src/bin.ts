#!/usr/bin/env node

import { main } from "./index.js";

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(3);
  });
