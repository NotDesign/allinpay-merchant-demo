// Developer edition: readable, multi-file External.
require("./build-readable.cjs")
  .build("external")
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
