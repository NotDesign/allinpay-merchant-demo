// Readable developer build. Reference data, artwork, CSS and application JS stay separate.
const fs = require("node:fs");
const path = require("node:path");
const prettier = require("prettier");
const root = __dirname;
const config = require("./build-config.json");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const script = (name) => `<script defer src="${name}"></script>`;
async function write(name, text, parser) {
  fs.writeFileSync(
    path.join(root, name),
    await prettier.format(text, { parser, printWidth: 100 }),
  );
}
async function build(target = "all") {
  const map = {
    edition: "2026.11.17-dev2-v1.12",
    referenceScripts: config.referenceScripts,
    bundles: {},
  };
  async function bundle(name, prefix, modules, suffix) {
    let text = prefix;
    const locations = [];
    for (const module of modules) {
      text += `\n// SOURCE MODULE: ${module}\n`;
      const start = text.split("\n").length;
      const source = read(module);
      text += source + "\n";
      locations.push({
        source: module,
        startLine: start,
        endLine: start + source.split("\n").length - 1,
      });
    }
    text += suffix;
    // Modules are already formatted. Keep concatenation unchanged for an exact line-to-source map.
    fs.writeFileSync(path.join(root, name), text);
    map.bundles[name] = locations;
  }
  const tags = [
    script("fixtures/dev-merchants.js"),
    ...config.referenceScripts.map(script),
  ];
  if (target === "all" || target === "admin") {
    const source = read("core.js");
    const entry = /render\(\);\s*\}\)\(\);\s*$/;
    if (!entry.test(source)) throw Error("Missing backend entry");
    await bundle(
      "app.js",
      read("version-router.js") + "\n" + source.replace(entry, ""),
      config.adminModules,
      "\nrender();\n})();\n",
    );
    const html = read("index.html").replace(
      "<!-- DEVELOPER_SCRIPTS -->",
      [...tags, script("data.js"), script("app.js")].join("\n"),
    );
    await write("backoffice.html", html, "html");
  }
  if (target === "all" || target === "external") {
    const source = read("external.js");
    const marker = "// READABLE_SHARED_ENTRY";
    if (!source.includes(marker))
      throw Error("Missing External extension entry");
    const [prefix, suffix] = source.split(marker);
    await bundle(
      "external-app.js",
      read("version-router.js") + "\n" + prefix,
      config.externalModules,
      suffix,
    );
    const css = config.externalStyles
      .map((name) => `<link rel="stylesheet" href="${name}">`)
      .join("\n");
    const html = read("external.template.html")
      .replace(/<style>\s*\/\* BUNDLE_CSS \*\/\s*<\/style>/, css)
      .replace(
        /<script>\s*\/\* BUNDLE_ASSETS \*\/\s*<\/script>/,
        [script("assets.js"), ...tags].join("\n"),
      )
      .replace(
        /<script>\s*\/\* BUNDLE_JS \*\/\s*<\/script>/,
        script("external-app.js"),
      )
      .replace("Mee Pay · 外部商戶申請 Demo", "Mee Pay · 兩商戶外部開發版");
    await write("external.html", html, "html");
  }
  // index.html is an editable template; serve the built backend for root requests.
  const existing = fs.existsSync(path.join(root, "module-map.json"))
    ? JSON.parse(read("module-map.json"))
    : { bundles: {} };
  map.bundles = { ...existing.bundles, ...map.bundles };
  await write("module-map.json", JSON.stringify(map), "json");
  console.log(
    "Readable developer build:",
    target,
    "(two merchants, external assets, no minification)",
  );
}
module.exports = { build };
if (require.main === module)
  build(process.argv[2] || "all").catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
