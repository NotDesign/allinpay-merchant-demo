// Developer edition: readable, multi-file backend.
require("./build-readable.cjs")
  .build("admin")
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
