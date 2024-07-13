import type { NodePath, types as t, types } from '@babel/core'
import type { Binding, Scope } from '@babel/traverse'

export function getUidInScope(name: string, scope: Scope, bindingReusable?: (binding: Binding) => boolean) {
  let newName = name
  let newNameRetry = 0

  // eslint-disable-next-line no-cond-assign
  for (let binding; binding = scope.getBinding(newName);) {
    if (bindingReusable && bindingReusable(binding)) break
    newName = `${name}_${++newNameRetry}` // try next name
  }

  return newName
}

export type ImportingManager = ReturnType<typeof getImportingManager>
export function getImportingManager(t: typeof types, programPath: NodePath<t.Program>, module: string) {
  const programScope = programPath.scope
  let importDeclarations = [] as NodePath<t.ImportDeclaration>[]
  let importedBindings = {} as Record<string, Binding[]>

  /** re-crawl all import declarations */
  function crawl() {
    importDeclarations = []
    importedBindings = {}

    programPath.get('body').forEach((path) => {
      if (!path.isImportDeclaration()) return
      if (path.node.importKind && path.node.importKind !== 'value') return // avoid type importing
      if (path.node.source.value !== module) return

      importDeclarations.push(path)
      path.get('specifiers').forEach((specifier) => {
        if (!specifier.isImportSpecifier()) return
        if (specifier.node.importKind && specifier.node.importKind !== 'value') return // avoid type importing

        if (specifier.node.imported.type !== 'Identifier') return
        const importedName = specifier.node.imported.name
        if (!importedBindings[importedName]) importedBindings[importedName] = []

        importedBindings[importedName].push(programScope.getBinding(specifier.node.local.name)!)
      })
    })
  }

  /** get a imported symbol that usable in `scope`. if not imported, import it and return the name */
  function getImportedSymbol(source: string, scope: Scope, isNameReusable = (_name: string) => true, preferredName = source) {
    // first, check if already imported and reuseable
    const exist = importedBindings[source] || []
    for (const binding of exist) {
      const name = (binding.path.node as t.ImportSpecifier).local.name
      if (scope.getBinding(name)?.scope !== programScope) continue
      if (!isNameReusable(name)) continue
      return name
    }

    // not imported yet
    if (!importDeclarations.length) {
      importDeclarations.push(programPath.unshiftContainer('body',
        t.importDeclaration([], t.stringLiteral(module)),
      )[0])
    }

    // generate a new identifier
    const importDeclaration = importDeclarations[importDeclarations.length - 1]
    const name = getUidInScope(preferredName, scope)
    importDeclaration.pushContainer('specifiers', [
      t.importSpecifier(t.identifier(name), t.identifier(source)),
    ])

    programScope.crawl()
    if (!importedBindings[source]) importedBindings[source] = []
    importedBindings[source].push(scope.getBinding(name)!)

    return name
  }

  /** check if a symbol is imported, return the source name in module */
  function isImportedSymbol(path: NodePath<t.Node> | null | undefined) {
    if (!path) return null
    if (!path.isImportSpecifier()) return null
    const entries = Object.entries(importedBindings)

    for (const [source, bindings] of entries) {
      if (bindings.some(binding => binding.path === path)) return source
    }
    return null
  }

  crawl()
  return {
    crawl,
    getImportedSymbol,
    isImportedSymbol,
    getImportDeclarations: () => importDeclarations,
  }
}

export function getReturns(path: NodePath<t.Function>): NodePath<t.ReturnStatement>[] {
  const returns = [] as NodePath<t.ReturnStatement>[]
  path.traverse({
    Function: (p) => {
      p.skip()
    },
    ReturnStatement: (p) => {
      returns.push(p)
      p.skip()
    },
  })
  return returns
}

export function replaceWithJSXElement(t: typeof types, path: NodePath, tagName: string, attributes: t.JSXAttribute[]) {
  let replaceAt = path

  const parentPath = path.parentPath
  if (parentPath && parentPath.isJSXExpressionContainer() && !parentPath.parentPath.isJSXAttribute()) replaceAt = parentPath

  const jsxElementPath = replaceAt.replaceWith(t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(tagName), attributes, true),
    null, [], true,
  ))[0]

  return jsxElementPath
}
