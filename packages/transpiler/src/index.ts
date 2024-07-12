// @ts-check

import type { PluginObj } from '@babel/core'
import type { NodePath, Scope } from '@babel/traverse'
import type * as t from '@babel/types'

interface PluginState {
  macroSource: Record<string, string> // { localName: macroName }
  runtimeSource: Record<string, string>
  getRuntimeFunctionIdentifier: (source: string, currentScope: Scope) => t.Identifier
  getMacroIdentifier: (source: string, scope: Scope) => t.Identifier
}

type MacroName = 'scopeComponent' | 'scopeVar' | 'Scope' | 'ScopeFor'

const macroPackageId = 'hey-stack-macro'
const runtimePackageId = 'hey-stack-runtime'

interface ScopeSetupFnState {
  definePath: NodePath<t.CallExpression> // the `defineScopeComponent(...)` call
  path: NodePath<t.Function>
  vars: Record<string, {
    declarator: NodePath<t.VariableDeclarator>
    options: t.ObjectExpression
  }>
  ctxParamName: string // name of `scopeCtx` param
  toHoist: {
    path: NodePath<t.Expression>
    name: string
    onHoist?: (name: string, stubPath: NodePath<t.Identifier>, declarator: NodePath<t.VariableDeclarator>) => void
  }[]
}
const $scopeSetupFn = Symbol('isScopeSetupFn')

function plugin({ types }: { types: typeof t }): PluginObj<PluginState> {
  /**
   * handle `Scope(...)`, `scopeVar(...)` etc. call-expression
   */
  const macroHandler = {
    scopeComponent(path, state) {
      path.set('callee', state.getRuntimeFunctionIdentifier('defineScopeComponent', path.scope))

      const setupFn = path.get('arguments')[0]
      if (!setupFn.isFunction()) throw new Error('scope() must be used with a function')
      if (setupFn.node.params.length > 0) throw new Error('scope() setupFn cannot have parameters')

      const ctxParam = path.scope.generateUidIdentifier('ctx')
      const setupFnState: ScopeSetupFnState = {
        definePath: path,
        path: setupFn,
        vars: {},
        ctxParamName: ctxParam.name,
        toHoist: [],
      }
      setupFn.setData($scopeSetupFn, setupFnState)
      setupFn.node.params.push(ctxParam)
      setupFn.scope.crawl()
    },
    scopeVar(path) {
      // TODO: beware that `path.node.callee` can be a MemberExpression.
      // eg. `scopeVar.computed(x)`
      //     `scopeVar.computed.private(expr, val => ...)`
      //     `scopeVar.inherited()`

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

      // find all decorators like "computed", "inherited" etc.
      const decorators = {} as Record<string, t.Expression | true>
      {
        let m = path.node.callee
        while (types.isMemberExpression(m)) {
          const property = m.property
          if (!types.isIdentifier(property)) throw new Error('scopeVar.xxx only accepts literal, not dynamic')

          decorators[property.name] = true
          m = m.object
        }
      }

      // if provide function1, ensure it is a expression
      const args = path.node.arguments as t.Expression[]
      if (args.some(n => !types.isExpression(n))) throw new Error('scopeVar() only accepts expression params, do not use rest spreading')

      const optionsObjectProperties = [] as t.ObjectProperty[]

      if (decorators.inherited) {
        if (args.length > 0) throw new Error('scopeVar.inherited() cannot have an expression inside')
      }
      else if (decorators.computed) {
        if (!args[0]) throw new Error('scopeVar.computed() must have an expression inside')
        optionsObjectProperties.push(types.objectProperty(types.identifier('get'), types.arrowFunctionExpression([], args[0])))

        if (args.length >= 2) {
          // has setter
          optionsObjectProperties.push(types.objectProperty(types.identifier('set'), types.arrowFunctionExpression([], args[1])))
        }
      }
      else {
        if (!args[0]) throw new Error('scopeVar() must have an expression inside')
        optionsObjectProperties.push(types.objectProperty(types.identifier('value'), args[0]))
      }

      // other common decorators
      if (decorators.private) {
        optionsObjectProperties.push(types.objectProperty(types.identifier('private'), types.booleanLiteral(true)))
      }

      setupFnState.vars[name] = {
        declarator,
        options: types.objectExpression(optionsObjectProperties),
      }
    },
    Scope(path, state) {
      // turn `Scope(() => ...)` into `<NewComponent1234>` and a new `scopeComponent()`

      const setupFnPath = path.findParent(p => p.isFunction() && p.getData($scopeSetupFn)) as NodePath<t.Function>
      if (!setupFnPath) throw new Error('Scope() must be used in a scopeComponent(), Scope() or ScopeFor()')

      const setupFn = setupFnPath.getData($scopeSetupFn) as ScopeSetupFnState
      setupFn.toHoist.push({
        path: path,
        name: 'NewComponent', // first letter must be uppercase
        onHoist(name, stubPath) {
          replaceWithJSXElement(
            types,
            stubPath,
            name,
            [],
          )
        },
      })

      // reuse `scopeComponent()` logic
      macroHandler.scopeComponent(path, state)
    },
    ScopeFor(path, state) {
      // turn `ScopeFor(items, (item, key, items) => ...)` into `<ScopeFor>` and a new `scopeComponent()`

      const [arg1, arg2] = path.get('arguments')
      if (!arg1 || !arg1.isExpression()) throw new Error('ScopeFor must have an argument')
      if (!arg2 || !(arg2.isArrowFunctionExpression() || arg2.isFunctionExpression())) throw new Error('ScopeFor must have a childComponent')

      // turn 2nd argument into another `scope()` declaration

      const childComponentBody
        = types.isExpression(arg2.node.body)
          ? types.blockStatement([types.returnStatement(arg2.node.body)])
          : arg2.node.body

      const childComponent = types.callExpression(
        state.getMacroIdentifier('scopeComponent', path.scope),
        [
          types.arrowFunctionExpression([], childComponentBody, arg2.node.async),
        ],
      )

      // all attributes goes here
      const jsxAttrs = [
        // `items` attribute
        types.jsxAttribute(
          types.jsxIdentifier('items'),
          types.jsxExpressionContainer(
            types.arrowFunctionExpression([], arg1.node),
          ),
        ),
        // `childComponent` attribute
        types.jsxAttribute(
          types.jsxIdentifier('childComponent'),
          types.jsxExpressionContainer(
            childComponent,
          ),
        ),
        // "as", "keyAs", "itemsAs" attributes will be generated later
      ]

      // generate JSX attributes "as", "keyAs", "itemsAs"
      {
        const params = arg2.get('params')
        const [item, key, items] = Array.isArray(params) ? params : [params]

        function transformParam(param: NodePath<t.Node> | undefined, jsxAttrName: string) {
          if (!param) return
          if (!param.isIdentifier()) throw new Error('render function of ScopeFor not support destructuring param yet')

          const name = param.node.name
          const references = param.scope.getBinding(name)?.referencePaths
          if (!references?.length) return // unused param

          param.remove()

          // add jsx attribute
          jsxAttrs.push(
            types.jsxAttribute(
              types.jsxIdentifier(jsxAttrName),
              types.stringLiteral(name),
            ),
          )

          // add `scopeVar` in `setupFn`
          childComponentBody.body.unshift(
            types.variableDeclaration('let', [
              types.variableDeclarator(
                types.identifier(name),
                types.callExpression(
                  types.memberExpression(
                    state.getMacroIdentifier('scopeVar', path.scope),
                    types.identifier('inherited'), // scopeVar.inherited
                  ),
                  [],
                ),
              ),
            ]),
          )
        }

        transformParam(item, 'as')
        transformParam(key, 'keyAs')
        transformParam(items, 'itemsAs')
      }

      // generate the JSX element and replace the original `ScopeFor` call
      const jsxPath = replaceWithJSXElement(
        types,
        path,
        state.getRuntimeFunctionIdentifier('ScopeFor', path.scope).name,
        jsxAttrs,
      )
      jsxPath.visit()

      // later, hoist attributes outside of `ScopeFor`
      const setupFnPath = jsxPath.findParent(p => p.isFunction() && p.getData($scopeSetupFn)) as NodePath<t.Function>
      if (setupFnPath) {
        const setupFn = setupFnPath.getData($scopeSetupFn) as ScopeSetupFnState
        const attributes = jsxPath.get('openingElement').get('attributes') as NodePath<t.JSXAttribute>[]

        // mark items getter as hoisted
        setupFn.toHoist.push({
          path: (attributes[0].get('value') as NodePath<t.JSXExpressionContainer>).get('expression') as NodePath<t.Expression>,
          name: 'items',
        })

        // mark childComponent as hoisted
        setupFn.toHoist.push({
          path: (attributes[1].get('value') as NodePath<t.JSXExpressionContainer>).get('expression') as NodePath<t.Expression>,
          name: 'itemRender',
        })
      }
    },
  } satisfies Record<MacroName, (path: NodePath<t.CallExpression>, state: PluginState) => any>

  return {
    visitor: {
      Program: {
        enter(path, state) {
          state.macroSource = {}
          state.runtimeSource = {}

          let runtimeImport: t.ImportDeclaration
          let macroImport: NodePath<t.ImportDeclaration>

          path.traverse({
            ImportDeclaration(importPath) {
              if (importPath.node.source.value === macroPackageId) {
                macroImport = importPath
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
            const newId = getValidIdentifierNameInScope(source, scope)
            runtimeImport.specifiers.push(
              types.importSpecifier(types.identifier(newId), types.identifier(source)),
            )
            scope.crawl()

            return types.identifier(newId)
          }
          state.getMacroIdentifier = (source, scope) => {
            if (!macroImport.node) {
              macroImport = path.unshiftContainer('body',
                types.importDeclaration([], types.stringLiteral(macroPackageId)),
              )[0]
            }

            // find a useable identifier
            for (const specifier of macroImport.node.specifiers) {
              if (!types.isImportSpecifier(specifier)) continue
              if (!types.isIdentifier(specifier.imported)) continue
              if (specifier.imported.name !== source) continue

              const binding = scope.getBinding(specifier.local.name)
              if (binding && binding.path.node === specifier) return types.identifier(specifier.local.name)
            }

            // generate a new identifier
            const newId = getValidIdentifierNameInScope(source, scope)
            macroImport.node.specifiers.push(
              types.importSpecifier(types.identifier(newId), types.identifier(source)),
            )
            scope.crawl()

            return types.identifier(newId)
          }
        },
      },
      CallExpression(path, state) {
        let callee = path.node.callee
        while (types.isMemberExpression(callee)) callee = callee.object
        if (!types.isIdentifier(callee)) return

        const binding = path.scope.getBinding(callee.name)
        const importSource = binding && binding.path.isImportSpecifier() && state.macroSource[callee.name]
        if (!importSource || !(importSource in macroHandler)) return

        // this function call is a macro
        macroHandler[importSource as MacroName](path, state)
      },
      Function: {
        exit(path, state) {
          const setupFn = path.getData($scopeSetupFn) as ScopeSetupFnState
          if (!setupFn) return
          path.setData($scopeSetupFn, undefined) // transformed, kill the state

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

          function transformReturn() {
            const returns = getReturns(path)
            if (!returns.length) throw new Error('scope() must return a fragment')
            if (returns.length > 1) throw new Error('scope() can only have a return statement')

            const returnPath = returns[0]!
            const renderFn = returnPath.get('argument')
            if (!renderFn.node) throw new Error('scope() setup function must return a render function or JSX')

            // if not a render function, wrap it into `() => (expr)`
            if (renderFn.isFunction()) {
              // maybe assume it's a render function
            }
            else if (renderFn.isJSXElement() || renderFn.isJSXFragment()) {
              // turn it into a render function
              returnPath.set('argument', types.arrowFunctionExpression([], renderFn.node))
            }
            else {
              // must return a render function or JSX
              throw new Error('scope() must return a JSX or render function')
            }

            return returnPath
          }

          function moveHoistedThings(beforeWhere: NodePath) {
            const hoistedDeclaratorNodes = [] as t.VariableDeclarator[]

            const newNames = [] as string[]
            const stubPaths = [] as NodePath<t.Identifier>[]

            const tasks = setupFn.toHoist.splice(0)
            tasks.forEach(({ path, name }) => {
              const newName = getValidIdentifierNameInScope(name, path.scope)
              hoistedDeclaratorNodes.push(types.variableDeclarator(types.identifier(newName), path.node))
              newNames.push(newName)
              stubPaths.push(path.replaceWith(types.identifier(newName))[0])
            })

            if (hoistedDeclaratorNodes.length) {
              const declPath = beforeWhere.insertBefore(types.variableDeclaration('const', hoistedDeclaratorNodes))[0]
              const declaratorPaths = declPath.get('declarations')
              tasks.forEach(({ onHoist }, index) => {
                if (typeof onHoist === 'function') onHoist(newNames[index], stubPaths[index], declaratorPaths[index])
              })
            }
          }

          transformDefineScopeVariable()
          const returnPath = transformReturn()
          moveHoistedThings(returnPath)
        },
      },
    },
  }
}

function getValidIdentifierNameInScope(name: string, scope: Scope) {
  let newName = name
  let newNameRetry = 0
  while (scope.hasBinding(newName)) newName = `${name}_${++newNameRetry}`
  return newName
}

function getReturns(path: NodePath<t.Function>): NodePath<t.ReturnStatement>[] {
  const returns = [] as NodePath<t.ReturnStatement>[]
  path.traverse({
    Function: p => void p.skip(),
    ReturnStatement: p => void returns.push(p),
  })
  return returns
}

function replaceWithJSXElement(types: typeof t, path: NodePath, name: string, attributes: t.JSXAttribute[]) {
  let replaceAt = path

  const parentPath = path.parentPath
  if (parentPath && parentPath.isJSXExpressionContainer() && !parentPath.parentPath.isJSXAttribute()) replaceAt = parentPath

  const jsxElementPath = replaceAt.replaceWith(types.jsxElement(
    types.jsxOpeningElement(types.jsxIdentifier(name), attributes, true),
    null, [], true,
  ))[0]

  return jsxElementPath
}

export default plugin
