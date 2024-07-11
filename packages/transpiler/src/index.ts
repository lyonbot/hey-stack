// @ts-check

import type { PluginObj } from '@babel/core'
import type { NodePath, Scope } from '@babel/traverse'
import type * as t from '@babel/types'

interface PluginState {
  macroSource: Record<string, string>
  runtimeSource: Record<string, string>
  getRuntimeFunctionIdentifier: (source: string, currentScope: Scope) => t.Identifier
}

const macroPackageId = 'hey-stack-macro'
const runtimePackageId = 'hey-stack-runtime'

interface ScopeSetupFnState {
  path: NodePath<t.Function>
  vars: Record<string, {
    declarator: NodePath<t.VariableDeclarator>
    options: t.ObjectExpression
  }>
  ctxParamName: string // name of `scopeCtx` param
}
const $scopeSetupFn = Symbol('isScopeSetupFn')

function plugin({ types }: { types: typeof t }): PluginObj<PluginState> {
  /**
   * handle `scope(...)`, `scopeVar(...)` etc. call-expression
   */
  const macroHandler: Record<string, (path: NodePath<t.CallExpression>, state: PluginState) => void> = {
    scope(path, state) {
      path.set('callee', state.getRuntimeFunctionIdentifier('defineScopeComponent', path.scope))

      const setupFn = path.get('arguments')[0]
      if (!setupFn.isFunction()) throw new Error('scope() must be used with a function')
      if (setupFn.node.params.length > 0) throw new Error('scope() setupFn cannot have parameters')

      const ctxParam = path.scope.generateUidIdentifier('ctx')
      const setupFnState: ScopeSetupFnState = {
        path: setupFn,
        vars: {},
        ctxParamName: ctxParam.name,
      }
      setupFn.setData($scopeSetupFn, setupFnState)
      setupFn.node.params.push(ctxParam)
      setupFn.scope.crawl()
    },
    scopeVar(path) {
      // TODO: beware that `path.node.callee` can be a MemberExpression.
      // eg. `scopeVar.computed(x)`

      const setupFn = path.getFunctionParent()
      const setupFnState = setupFn && setupFn.getData($scopeSetupFn) as ScopeSetupFnState
      if (!setupFnState) throw new Error('scopeVar must be used in scope()')

      const declarator = path.parentPath
      if (!declarator.isVariableDeclarator()) throw new Error('scopeVar must be used in variable declarator')

      const id = declarator.node.id
      if (!types.isIdentifier(id)) throw new Error('scopeVar declaration cannot be destructured')

      // register to `defineScopeVariable`
      const name = id.name
      if (setupFnState.vars[name]) throw new Error(`scopeVar name already used: ${name}`)

      const valueExpr = path.node.arguments[0]
      if (!types.isExpression(valueExpr)) throw new Error('scopeVar only accepts an expression')

      setupFnState.vars[name] = {
        declarator,
        options: types.objectExpression([
          types.objectProperty(types.identifier('value'), valueExpr),
        ]),
      }
    },
  }

  return {
    visitor: {
      Program: {
        enter(path, state) {
          state.macroSource = {}
          state.runtimeSource = {}

          let runtimeImport: t.ImportDeclaration

          path.traverse({
            ImportDeclaration(importPath) {
              if (importPath.node.source.value === macroPackageId) {
                importPath.node.specifiers.forEach((specifier) => {
                  if (!types.isImportSpecifier(specifier)) return
                  if (!types.isIdentifier(specifier.imported)) return
                  state.macroSource[specifier.local.name] = specifier.imported.name
                })
              }

              if (importPath.node.source.value === runtimePackageId) {
                runtimeImport = importPath.node
              }
            },
          })

          state.getRuntimeFunctionIdentifier = (source, scope) => {
            if (!runtimeImport) {
              runtimeImport = types.importDeclaration([], types.stringLiteral(runtimePackageId))
              path.unshiftContainer('body', runtimeImport)
            }

            // check if existing identifier is available in current scope
            const goodSpec = runtimeImport.specifiers.find((spec) => {
              if (!types.isImportSpecifier(spec)) return false
              if (!types.isIdentifier(spec.imported) || spec.imported.name !== source) return false

              const binding = scope.getBinding(spec.local.name)
              if (!binding || binding.path.node === spec) return true // yes directly use

              if (!binding.path.isImportSpecifier()) return false
              return binding.path.parent === runtimeImport
            })
            if (goodSpec) return types.identifier(goodSpec.local.name)

            // create new identifier
            const newIdentifier = scope.generateUidIdentifier(source)
            runtimeImport.specifiers.push(
              types.importSpecifier(types.identifier(newIdentifier.name), types.identifier(source)),
            )
            return newIdentifier
          }
        },
      },
      CallExpression(path, state) {
        let callee = path.node.callee
        while (types.isMemberExpression(callee)) callee = callee.object
        if (!types.isIdentifier(callee)) return

        const binding = path.scope.getBinding(callee.name)
        const importSource = binding && binding.path.isImportSpecifier() && state.macroSource[callee.name]
        if (!importSource || !macroHandler[importSource]) return

        // this function call is a macro
        macroHandler[importSource](path, state)
      },
      Function: {
        exit(path, state) {
          const setupFn = path.getData($scopeSetupFn) as ScopeSetupFnState
          if (!setupFn) return

          function transformDefineScopeVariable() {
            // insert `defineScopeVariable` call
            const vars = Object.entries(setupFn.vars)

            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < vars.length; i++) {
              const [name, { options, declarator }] = vars[i]
              const declaration = declarator.parentPath
              if (!declaration.isVariableDeclaration()) throw new Error('weird error occurred')

              const scope = declaration.scope

              // 1. if has other declarator before, split the declaration into two declarations
              const declarators = declaration.node.declarations
              const declIdx = declarators.indexOf(declarator.node)
              if (declIdx > 0) {
                const decl2 = types.variableDeclaration(declaration.node.kind, declarators.slice(0, declIdx))
                declaration.insertBefore(decl2)
              }

              const defineOptions = types.objectExpression([
                types.objectProperty(types.identifier(name), options),
              ])
              scope.getBinding(name)?.referencePaths?.forEach((referencePath) => {
                referencePath.replaceWith(types.memberExpression(
                  types.identifier(setupFn.ctxParamName),
                  types.identifier(name),
                ))
              })

              // insert `defineScopeVariable` call
              declaration.insertBefore(
                types.expressionStatement(
                  types.callExpression(
                    state.getRuntimeFunctionIdentifier('defineScopeVariable', path.scope),
                    [
                      types.identifier(setupFn.ctxParamName),
                      defineOptions,
                    ],
                  ),
                ),
              )

              // remove declarators
              declarators.splice(0, declIdx + 1)
              if (!declarators.length) declaration.remove()
              scope.crawl()
            }
          }
          transformDefineScopeVariable()

          function transformReturn() {
            const returns = [] as NodePath<t.ReturnStatement>[]
            path.traverse({
              Function: p => void p.skip(),
              ReturnStatement: p => void returns.push(p),
            })

            if (!returns.length) throw new Error('scope() must return a fragment')
            if (returns.length > 1) throw new Error('scope() can only have a return statement')

            const returnPath = returns[0]!
            const returnArgument = returnPath.get('argument')

            if (!returnArgument.isJSXFragment() && !returnArgument.isJSXElement()) {
              throw new Error('scope() must return a fragment')
            }
            returnPath.set('argument', types.arrowFunctionExpression([], returnArgument.node))
          }
          transformReturn()
        },
      },
    },
  }
}

export default plugin
