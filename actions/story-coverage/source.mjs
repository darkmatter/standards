import ts from "typescript";
import path from "node:path";

const script = /\.[cm]?[jt]sx?$/;
const canonical = (file) => path.posix.resolve("/", file);
const unwrap = (node) => {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node))
  )
    node = node.expression;
  return node;
};
const property = (node, name) =>
  unwrap(node)?.properties?.find((item) => item.name?.getText() === name);
const value = (node) =>
  node && (ts.isShorthandPropertyAssignment(node) ? node.name : node.initializer);

/** A compiler over a Git snapshot. Resolution never reads or executes checkout files. */
export function sourceGraph(files, roots) {
  const contents = new Map([...files].map(([file, text]) => [canonical(file), text]));
  const mounts = [];
  for (const [file, text] of contents) {
    if (!file.endsWith("/package.json")) continue;
    const manifest = JSON.parse(text);
    if (typeof manifest.name === "string")
      mounts.push([`/node_modules/${manifest.name}`, path.posix.dirname(file)]);
  }
  const actual = (file) => {
    const normalized = canonical(file);
    const mount = mounts.find(
      ([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    );
    return mount ? mount[1] + normalized.slice(mount[0].length) : normalized;
  };
  function configText(file) {
    const text = contents.get(actual(file));
    if (text === undefined || !file.endsWith(".json")) return text;
    const parsed = ts.parseConfigFileTextToJson(file, text);
    if (parsed.error || !parsed.config?.extends) return text;
    const expand = (entry) => {
      const mount = mounts.find(
        ([prefix]) =>
          entry === prefix.slice("/node_modules/".length) ||
          entry.startsWith(`${prefix.slice("/node_modules/".length)}/`),
      );
      if (!mount) return entry;
      const manifest = JSON.parse(contents.get(`${mount[1]}/package.json`));
      const subpath = entry.slice(manifest.name.length);
      const target = manifest.exports?.[subpath ? `.${subpath}` : "."];
      return typeof target === "string" ? path.posix.resolve(mount[1], target) : entry;
    };
    parsed.config.extends = Array.isArray(parsed.config.extends)
      ? parsed.config.extends.map(expand)
      : expand(parsed.config.extends);
    return JSON.stringify(parsed.config);
  }
  const names = [...contents.keys()].filter((file) => script.test(file));
  const directories = new Set(["/"]);
  for (const file of contents.keys()) {
    let dir = path.posix.dirname(file);
    while (dir !== "/") {
      directories.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  for (const [prefix] of mounts) {
    let dir = prefix;
    while (dir !== "/") {
      directories.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const host = {
    fileExists: (file) => contents.has(actual(file)),
    readFile: configText,
    directoryExists: (dir) => directories.has(actual(dir)),
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    realpath: actual,
  };
  const configs = new Map();
  function optionsFor(file) {
    let dir = path.posix.dirname(file);
    while (true) {
      const config = path.posix.join(dir, "tsconfig.json");
      if (contents.has(config)) {
        if (!configs.has(config)) {
          const parsed = ts.readConfigFile(config, host.readFile);
          if (parsed.error)
            throw new Error(
              `Cannot read ${config}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, " ")}`,
            );
          const resolved = ts.parseJsonConfigFileContent(
            parsed.config,
            { ...host, useCaseSensitiveFileNames: true, readDirectory: () => [] },
            dir,
          );
          const errors = resolved.errors.filter((error) => error.code !== 18003);
          if (errors.length)
            throw new Error(
              `Cannot resolve ${config}: ${errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, " ")).join("; ")}`,
            );
          configs.set(config, resolved.options);
        }
        return configs.get(config);
      }
      if (dir === "/") return {};
      dir = path.posix.dirname(dir);
    }
  }
  const options = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    noLib: true,
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const compilerHost = {
    ...host,
    getSourceFile: (file, languageVersion) => {
      const text = host.readFile(file);
      return text === undefined
        ? undefined
        : ts.createSourceFile(file, text, languageVersion, true);
    },
    getDefaultLibFileName: () => "/lib.d.ts",
    writeFile: () => {},
    getCanonicalFileName: canonical,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    resolveModuleNames: (modules, file) =>
      modules.map(
        (name) =>
          ts.resolveModuleName(name, file, { ...options, ...optionsFor(file) }, host)
            .resolvedModule,
      ),
  };
  const program = ts.createProgram(roots ? roots.map(canonical) : names, options, compilerHost);
  const checker = program.getTypeChecker();
  const resolve = (symbol) =>
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const symbolAt = (node) => resolve(checker.getSymbolAtLocation(node));
  const exportsOf = (file) => {
    const source = program.getSourceFile(canonical(file));
    const error = source && program.getSyntacticDiagnostics(source)[0];
    if (error)
      throw new Error(
        `Cannot parse ${file}: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`,
      );
    const symbol = source && checker.getSymbolAtLocation(source);
    return symbol ? checker.getExportsOfModule(symbol) : [];
  };
  function visit(node, fn) {
    fn(node);
    ts.forEachChild(node, (child) => visit(child, fn));
  }
  function jsxSymbols(node) {
    const symbols = new Set();
    visit(node, (child) => {
      if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
        const symbol = symbolAt(child.tagName);
        if (symbol) symbols.add(symbol);
      }
      if (
        ts.isCallExpression(child) &&
        /^(?:React\.)?createElement$/.test(child.expression.getText())
      ) {
        const symbol = child.arguments[0] && symbolAt(child.arguments[0]);
        if (symbol) symbols.add(symbol);
      }
    });
    return symbols;
  }
  function hasUI(node) {
    let found = false;
    visit(node, (child) => {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child))
        found = true;
      if (
        ts.isCallExpression(child) &&
        /^(?:React\.)?createElement$/.test(child.expression.getText())
      )
        found = true;
    });
    return found;
  }
  function components(file) {
    return exportsOf(file).flatMap((exported) => {
      const symbol = resolve(exported);
      const declaration = symbol?.valueDeclaration;
      if (!declaration || declaration.getSourceFile().fileName !== canonical(file)) return [];
      const name = exported.name;
      const localName = declaration.name?.getText() ?? name;
      if (name !== "default" && !/^[A-Z]/.test(name)) return [];
      if (!/^[A-Z]/.test(localName) && name !== "default") return [];
      const body = ts.isVariableDeclaration(declaration)
        ? unwrap(declaration.initializer)
        : ts.isExportAssignment(declaration)
          ? unwrap(declaration.expression)
          : declaration;
      if (
        !body ||
        !(
          ts.isFunctionDeclaration(body) ||
          ts.isFunctionExpression(body) ||
          ts.isArrowFunction(body) ||
          ts.isClassDeclaration(body) ||
          ts.isCallExpression(body)
        ) ||
        !hasUI(body)
      )
        return [];
      const line =
        declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart()).line + 1;
      return [{ file, name, symbol, line }];
    });
  }
  function stories(file) {
    const source = program.getSourceFile(canonical(file));
    if (!source) return [];
    const errors = program.getSyntacticDiagnostics(source);
    if (errors.length)
      throw new Error(
        `Cannot parse ${file}: ${ts.flattenDiagnosticMessageText(errors[0].messageText, " ")}`,
      );
    const exported = exportsOf(file);
    const metaSymbol = resolve(exported.find((item) => item.name === "default"));
    const declaration = metaSymbol?.valueDeclaration;
    let meta =
      declaration &&
      (ts.isExportAssignment(declaration)
        ? unwrap(declaration.expression)
        : unwrap(declaration.initializer));
    if (meta && ts.isIdentifier(meta)) {
      const target = symbolAt(meta)?.valueDeclaration;
      meta = target && unwrap(target.initializer);
    }
    const defaultMeta = meta;
    return exported
      .filter((item) => item.name !== "default" && !item.name.startsWith("__"))
      .flatMap((item) => {
        const declaration = resolve(item)?.valueDeclaration;
        let body =
          declaration &&
          (ts.isVariableDeclaration(declaration) ? unwrap(declaration.initializer) : declaration);
        let meta = defaultMeta;
        // Storybook CSF Next: const meta = preview.meta({...}); export const Story = meta.story({...}).
        if (
          body &&
          ts.isCallExpression(body) &&
          ts.isPropertyAccessExpression(body.expression) &&
          body.expression.name.text === "story"
        ) {
          const receiver = symbolAt(body.expression.expression)?.valueDeclaration;
          const factory = receiver && unwrap(receiver.initializer);
          if (
            !factory ||
            !ts.isCallExpression(factory) ||
            !ts.isPropertyAccessExpression(factory.expression) ||
            factory.expression.name.text !== "meta"
          )
            return [];
          meta = unwrap(factory.arguments[0]);
          body = unwrap(body.arguments[0]);
        }
        if (!meta || !ts.isObjectLiteralExpression(meta)) return [];
        function selection(name) {
          const entry = value(property(meta, name));
          if (!entry) return undefined;
          if (
            !ts.isArrayLiteralExpression(entry) ||
            entry.elements.some((element) => !ts.isStringLiteral(element))
          )
            throw new Error(`${file}: ${name} must be a literal string array for static coverage`);
          return entry.elements.map((element) => element.text);
        }
        const include = selection("includeStories");
        const exclude = selection("excludeStories") ?? [];
        if ((include && !include.includes(item.name)) || exclude.includes(item.name)) return [];
        if (
          !body ||
          !(
            ts.isObjectLiteralExpression(body) ||
            ts.isFunctionDeclaration(body) ||
            ts.isArrowFunction(body) ||
            ts.isFunctionExpression(body)
          )
        )
          return [];
        const ownRender = ts.isObjectLiteralExpression(body) ? property(body, "render") : body;
        let render = ownRender ?? property(meta, "render");
        const hasRender = Boolean(render);
        const renderValue =
          render && (ts.isPropertyAssignment(render) ? unwrap(render.initializer) : render);
        if (renderValue && ts.isIdentifier(renderValue))
          render = symbolAt(renderValue)?.valueDeclaration;
        const component = value(property(meta, "component"));
        const roots = hasRender
          ? render
            ? jsxSymbols(render)
            : new Set()
          : new Set(component ? [symbolAt(component)].filter(Boolean) : []);
        return [{ name: item.name, roots }];
      });
  }

  function renderedBy(story) {
    const seen = new Set();
    function walk(symbol) {
      if (seen.has(symbol)) return;
      seen.add(symbol);
      for (const declaration of symbol.declarations ?? []) {
        for (const child of jsxSymbols(declaration)) walk(child);
      }
    }
    for (const symbol of story.roots) walk(symbol);
    return seen;
  }
  return { components, stories, renderedBy };
}
