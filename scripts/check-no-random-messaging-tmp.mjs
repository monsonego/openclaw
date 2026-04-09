#!/usr/bin/env node

import ts from "typescript";
import { bundledPluginCallsite } from "./lib/bundled-plugin-paths.mjs";
import { runCallsiteGuard } from "./lib/callsite-guard.mjs";
import {
  collectCallExpressionLines,
  runAsScript,
  unwrapExpression,
} from "./lib/ts-guard-utils.mjs";

export const messagingTmpdirGuardSourceRoots = [
  "src/channels",
  "src/infra/outbound",
  "src/line",
  "src/media",
  "src/media-understanding",
  "extensions",
];
const allowedTmpdirCallsites = new Set([
  bundledPluginCallsite("feishu", "src/dedup.ts", 29),
  "src/infra/outbound/delivery-queue.test-helpers.ts:13",
  "extensions/active-memory/index.ts:1213",
  "extensions/browser/src/browser/chrome-mcp.ts:335",
  "extensions/diffs/src/test-helpers.ts:10",
  "extensions/google/video-generation-provider.ts:127",
  "extensions/memory-core/src/cli.runtime.ts:161",
  "extensions/memory-core/src/cli.runtime.ts:1723",
  "extensions/memory-core/src/test-helpers.ts:11",
  "extensions/memory-wiki/src/test-helpers.ts:40",
  "extensions/openshell/src/backend.ts:515",
  "extensions/qa-lab/src/gateway-child.ts:534",
  "extensions/qa-lab/src/model-catalog.runtime.ts:63",
  "extensions/qqbot/src/utils/platform.ts:56",
  "extensions/qqbot/src/utils/platform.ts:88",
  "extensions/signal/src/install-signal-cli.ts:250",
]);

function collectOsTmpdirImports(sourceFile) {
  const osModuleSpecifiers = new Set(["node:os", "os"]);
  const osNamespaceOrDefault = new Set();
  const namedTmpdir = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }
    if (!statement.importClause || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (!osModuleSpecifiers.has(statement.moduleSpecifier.text)) {
      continue;
    }
    const clause = statement.importClause;
    if (clause.name) {
      osNamespaceOrDefault.add(clause.name.text);
    }
    if (!clause.namedBindings) {
      continue;
    }
    if (ts.isNamespaceImport(clause.namedBindings)) {
      osNamespaceOrDefault.add(clause.namedBindings.name.text);
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      if ((element.propertyName?.text ?? element.name.text) === "tmpdir") {
        namedTmpdir.add(element.name.text);
      }
    }
  }
  return { osNamespaceOrDefault, namedTmpdir };
}

export function findMessagingTmpdirCallLines(content, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const { osNamespaceOrDefault, namedTmpdir } = collectOsTmpdirImports(sourceFile);
  return collectCallExpressionLines(ts, sourceFile, (node) => {
    const callee = unwrapExpression(node.expression);
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "tmpdir" &&
      ts.isIdentifier(callee.expression) &&
      osNamespaceOrDefault.has(callee.expression.text)
    ) {
      return callee;
    }
    return ts.isIdentifier(callee) && namedTmpdir.has(callee.text) ? callee : null;
  });
}

export async function main() {
  await runCallsiteGuard({
    importMetaUrl: import.meta.url,
    sourceRoots: messagingTmpdirGuardSourceRoots,
    findCallLines: findMessagingTmpdirCallLines,
    allowCallsite: (callsite) => allowedTmpdirCallsites.has(callsite),
    header: "Found os.tmpdir()/tmpdir() usage in messaging/channel runtime sources:",
    footer:
      "Use resolvePreferredOpenClawTmpDir() or plugin-sdk temp helpers instead of host tmp defaults.",
    sortViolations: false,
  });
}

runAsScript(import.meta.url, main);
