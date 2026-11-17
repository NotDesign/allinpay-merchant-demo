// Legacy entry now delegates to the shared readable builder.
require("./build-readable.cjs")
  .build()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
