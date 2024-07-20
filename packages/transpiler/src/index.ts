// @ts-check

import type { PluginObj } from '@babel/core'
import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'

import { getIdentifiersFromPattern, getImportingManager, getReturns, getUidInScope, ImportingManager, replaceWithJSXElement } from './babelUtils'
import { isComponentName, toComponentName } from './utils'

const $pluginState = Symbol('pluginState')
interface PluginState {
  macroImport: ImportingManager
  runtimeImport: ImportingManager
}

type MacroName = 'scopeComponent' | 'scopeVar' | 'Scope' | 'ScopeFor'

const macroPackageId = 'hey-stack-macro'
const runtimePackageId = 'hey-stack-runtime'

interface ScopeSetupFnState {
  processed?: boolean
  definePath: NodePath<t.CallExpression> // the `defineScopeComponent(...)` call
  path: NodePath<t.Function>
  vars: Record<string, {
    declarator: NodePath<t.VariableDeclarator>
    options: t.ObjectExpression
    isReadonly: string | false // optional, error message
  }>
  ctxParamName: string // name of `scopeCtx` param
  toHoist: {
    path: NodePath<t.Expression>
    name: string
    onHoist?: (name: string, stubPath: NodePath<t.Identifier>, declarator: NodePath<t.VariableDeclarator>) => void
  }[]

  /** managed by parent setupFn. when ancestor find a variable is used in sub scope, the ancestor shall update descendant's code by adding `defineScopeVar` */
  inheritedScopeVar?: {
    declaration: NodePath<t.VariableDeclaration>
    added: Set<string>
  }
}

const $scopeSetupFn = Symbol('isScopeSetupFn') // a data of scopeFn function node
const $scopeVar = Symbol('isScopeVar') // a data of scopeVar declarator node

const C_RAW_SCOPE_VAR_POINTER = '@hey-stack/core:rawScopeVarPointer'

function plugin({ types }: { types: typeof t }): PluginObj<{ [$pluginState]: PluginState }> {
  /**
   * handle `Scope(...)`, `scopeVar(...)` etc. call-expression
   */
  const macroHandler = {
    scopeComponent(path) {
      // generate a new SetupFnState for `setupFn` and further traversing
      // no code modified here

      // scopeComponent(name, setupFn)
      // scopeComponent(setupFn)

      const setupFn = path.get('arguments')[1] || path.get('arguments')[0]
      if (!setupFn.isFunction()) throw path.buildCodeFrameError('scope() must be used with a function')
      if (setupFn.node.params.length > 0) throw path.buildCodeFrameError('scope() setupFn cannot have parameters')

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

      // optional name
      let name = 'AnonymousComponent'
      const arg0 = path.get('arguments')[0]
      if (arg0.isStringLiteral() && arg0.node.value) name = toComponentName(arg0.node.value)

      return {
        name,
      }
    },
    scopeVar(path) {
      // collect all scopeVar() and fill into nearest setupFnState
      // no code modified here

      // beware that `path.node.callee` can be a MemberExpression.
      // eg. `scopeVar.computed(() => xxxx)`
      //     `scopeVar.computed(() => expr, val => ...)`
      //     `scopeVar.inherited()`

      const setupFn = path.getFunctionParent()
      const setupFnState = setupFn && setupFn.getData($scopeSetupFn) as ScopeSetupFnState
      if (!setupFnState) throw path.buildCodeFrameError('scopeVar must be used in scope()')

      const declarator = path.parentPath
      if (!declarator.isVariableDeclarator()) throw path.buildCodeFrameError('scopeVar must be used in variable declarator')

      const id = declarator.node.id
      if (!types.isIdentifier(id)) throw path.buildCodeFrameError('scopeVar declaration cannot be destructured')

      // register to `defineScopeVariable`
      const name = id.name
      if (setupFnState.vars[name]) throw path.buildCodeFrameError(`scopeVar name already used: ${name}`)

      // find all decorators like "computed", "inherited" etc.
      const decorators = {} as Record<string, t.Expression | true>
      {
        let m = path.node.callee
        while (types.isMemberExpression(m)) {
          const property = m.property
          if (!types.isIdentifier(property)) throw path.buildCodeFrameError('scopeVar.xxx only accepts literal, not dynamic')

          decorators[property.name] = true
          m = m.object
        }
      }

      // if provide function1, ensure it is a expression
      const args = path.node.arguments as t.Expression[]
      if (args.some(n => !types.isExpression(n))) throw path.buildCodeFrameError('scopeVar() only accepts expression params, do not use rest spreading')

      const optionsToGenerate = {} as Record<string, t.Expression>

      if (decorators.inherited) {
        let arg0 = args[0]
        const arg1 = args[1]

        if (!arg0 || types.isNullLiteral(arg0)) arg0 = types.stringLiteral(name)
        if (types.isIdentifier(arg0)) arg0 = types.stringLiteral(arg0.name === 'undefined' ? name : arg0.name)
        if (!types.isStringLiteral(arg0)) throw path.buildCodeFrameError('bad 1st param of scopeVar.inherited(): must be a identifier or have a string literal as argument')

        optionsToGenerate['inherited'] = arg0

        if (arg1) {
          // default value
          optionsToGenerate['default'] = types.arrowFunctionExpression([], arg1)
        }

        if (args.length > 2) throw path.buildCodeFrameError('scopeVar.inherited() accepts up to 2 arguments')
      }
      else if (decorators.computed) {
        if (!args[0]) throw path.buildCodeFrameError('scopeVar.computed() must have a getter function')
        optionsToGenerate.get = args[0]

        if (args.length >= 2) {
          // has setter
          optionsToGenerate.set = args[1]
        }
      }
      else {
        if (!args[0]) throw path.buildCodeFrameError('scopeVar() must have an expression inside')
        optionsToGenerate.value = args[0]

        if (decorators.ref) {
          optionsToGenerate.ref = types.booleanLiteral(true)
        }
      }

      declarator.setData($scopeVar, { setupFnState, name })
      setupFnState.vars[name] = {
        declarator,
        options: types.objectExpression(Object.entries(optionsToGenerate).map(([name, value]) => types.objectProperty(types.identifier(name), value))),
        isReadonly:
          (decorators.computed && !optionsToGenerate.set && 'the computed scopeVar has no setter')
          || false,
      }
    },
    Scope(path) {
      // turn `Scope(() => ...)` into `<NewComponent1234>` and a new `scopeComponent()`
      // no code modified here

      const setupFnPath = path.findParent(p => p.isFunction() && p.getData($scopeSetupFn)) as NodePath<t.Function>
      if (!setupFnPath) throw path.buildCodeFrameError('Scope() must be used in a scopeComponent(), Scope() or ScopeFor()')

      // reuse `scopeComponent()` logic
      const { name } = macroHandler.scopeComponent(path)

      const setupFn = setupFnPath.getData($scopeSetupFn) as ScopeSetupFnState
      setupFn.toHoist.push({
        path,
        name, // first letter must be uppercase
        onHoist(name, stubPath) {
          replaceWithJSXElement(
            types,
            stubPath,
            name,
            [],
          )
        },
      })
    },
    ScopeFor(path, state) {
      // turn `ScopeFor(items, (item, key, items) => ...)` into `<ScopeFor>` and a new `scopeComponent()`
      // Will modify the code

      const [arg1, arg2] = path.get('arguments')
      if (!arg1 || !arg1.isExpression()) throw path.buildCodeFrameError('ScopeFor must have an argument')
      if (!arg2 || !(arg2.isArrowFunctionExpression() || arg2.isFunctionExpression())) throw path.buildCodeFrameError('ScopeFor must have a childComponent')

      // turn 2nd argument into another `scope()` declaration

      const setupFnPath = path.findParent(p => p.isFunction() && p.getData($scopeSetupFn)) as NodePath<t.Function>
      let itemsGetterNeedHoist = false
      let itemsGetter: t.Expression
      {
        const scopeVarData = arg1.isIdentifier() && arg1.scope.getBinding(arg1.node.name)?.path.getData($scopeVar)
        if (scopeVarData) {
          // directly use the scopeVar as items
          itemsGetter = arg1.node
          itemsGetterNeedHoist = false
          types.addComment(itemsGetter, 'leading', C_RAW_SCOPE_VAR_POINTER, false)
        }
        else {
          // turn into a getter function
          itemsGetter = types.arrowFunctionExpression([], arg1.node)
          itemsGetterNeedHoist = true
        }
      }

      const childComponentBody
        = types.isExpression(arg2.node.body)
          ? types.blockStatement([types.returnStatement(arg2.node.body)])
          : arg2.node.body

      const childComponent = types.callExpression(
        types.identifier(state.macroImport.getImportedSymbol('scopeComponent', path.scope)),
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
            itemsGetter,
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
          if (!param.isIdentifier()) throw param.buildCodeFrameError('render function of ScopeFor not support destructuring param yet')

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
                    types.identifier(state.macroImport.getImportedSymbol('scopeVar', path.scope)),
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
        state.runtimeImport.getImportedSymbol('ScopeForRenderer', path.scope, isComponentName),
        jsxAttrs,
      )
      jsxPath.visit()

      // later, hoist attributes outside of `ScopeFor`
      if (setupFnPath) {
        const setupFn = setupFnPath.getData($scopeSetupFn) as ScopeSetupFnState
        const attributes = jsxPath.get('openingElement').get('attributes') as NodePath<t.JSXAttribute>[]

        // mark items getter as hoisted
        if (itemsGetterNeedHoist) {
          setupFn.toHoist.push({
            path: (attributes[0].get('value') as NodePath<t.JSXExpressionContainer>).get('expression') as NodePath<t.Expression>,
            name: 'items',
          })
        }

        // mark childComponent as hoisted
        setupFn.toHoist.push({
          path: (attributes[1].get('value') as NodePath<t.JSXExpressionContainer>).get('expression') as NodePath<t.Expression>,
          name: 'itemRender',
        })
      }
    },
  } satisfies Record<MacroName, (path: NodePath<t.CallExpression>, state: PluginState) => any>

  // normalFunctionStack
  let currentRegularFnState = {
    path: null as unknown as NodePath<t.Function>,
    hasAwait: [] as NodePath<t.AwaitExpression | t.ForOfStatement>[],
    prev: null as any,
  }

  return {
    visitor: {
      Program: {
        enter(path, globalState) {
          // initialize plugin state
          globalState[$pluginState] = {
            macroImport: getImportingManager(types, path, macroPackageId),
            runtimeImport: getImportingManager(types, path, runtimePackageId),
          }
        },
        exit(programPath, globalState) {
          const state = globalState[$pluginState]

          // remove macro import
          const scope = programPath.scope
          const macroImports = state.macroImport.getImportDeclarations()
          scope.crawl()

          for (const path of macroImports) {
            // ensure all specifiers are unused
            const safeToDelete = path.node.specifiers.every((spec) => {
              if (!types.isImportSpecifier(spec)) return false
              if (scope.getBinding(spec.local.name)?.referenced) return false

              return true
            })
            if (!safeToDelete) throw path.buildCodeFrameError('macro import is used')
            path.remove()
          }
        },
      },
      CallExpression(path, globalState) {
        // check if this is a macro call
        // if yes, call the macro handler

        const state = globalState[$pluginState]

        let callee = path.node.callee
        while (types.isMemberExpression(callee)) callee = callee.object // extract `scopeVar` from `scopeVar.foo.bar()`
        if (!types.isIdentifier(callee)) return

        const importSource = state.macroImport.isImportedSymbol(path.scope.getBinding(callee.name)?.path)
        if (!importSource || !(importSource in macroHandler)) return

        // this function call is a macro
        macroHandler[importSource as MacroName](path, state)
      },
      AwaitExpression(path) {
        currentRegularFnState.hasAwait.push(path)
      },
      ForAwaitStatement(path) {
        currentRegularFnState.hasAwait.push(path)
      },
      Function: {
        enter(path) {
          currentRegularFnState = {
            path,
            hasAwait: [],
            prev: currentRegularFnState,
          }
        },
        exit(path, globalState) {
          const regularFnState = currentRegularFnState
          currentRegularFnState = currentRegularFnState.prev

          // ----------------------------------------------

          const state = globalState[$pluginState]
          const setupFn = path.getData($scopeSetupFn) as ScopeSetupFnState
          if (!setupFn || setupFn.processed) return
          setupFn.processed = true

          // check if async
          setupFn.path.set('async', regularFnState.hasAwait.length > 0) // remove unused `async` marker

          // turn `scopeComponent()` into `defineScopeComponent()`
          setupFn.definePath.set('callee', types.identifier(
            state.runtimeImport.getImportedSymbol('defineScopeComponent', path.scope),
          ))

          function transformDefineScopeVariable() {
            // insert `defineScopeVariable` call
            const vars = Object.entries(setupFn.vars)

            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < vars.length; i++) {
              const [name, { options, declarator, ...otherScopeVarMeta }] = vars[i]
              const scope = declarator.scope
              const declaration = declarator.parentPath as NodePath<t.VariableDeclaration>

              // make `defineScopeVar(ctx, "name", options)` call
              declarator.set(
                'init',
                types.callExpression(
                  types.identifier(state.runtimeImport.getImportedSymbol('defineScopeVar', path.scope)),
                  [
                    types.identifier(setupFn.ctxParamName),
                    types.stringLiteral(name),
                    options,
                  ],
                ),
              )

              // foo => foo.value
              function addDotValue(idPath: NodePath<t.Identifier>) {
                let subSetupFnPath: NodePath | null = idPath
                let subSetupFn: ScopeSetupFnState | undefined
                while (
                  (subSetupFnPath = subSetupFnPath.findParent(p => p.isFunction() && (subSetupFn = p.getData($scopeSetupFn))))
                  && subSetupFnPath && subSetupFn
                  && subSetupFn !== setupFn // not in the same scope
                ) {
                  // this was a reference in a sub scope component.
                  // maybe we shall add `defineScopeVar` into the sub scope component

                  if (!subSetupFn.inheritedScopeVar) {
                    let body = subSetupFn.path.get('body')
                    if (!body.isBlockStatement()) {
                      // wtf? arrow function?
                      body = body.replaceWith(types.blockStatement([
                        types.returnStatement(body.node as t.Expression),
                      ]))[0]
                    }

                    const declaration = (body as NodePath<t.BlockStatement>).unshiftContainer(
                      'body',
                      types.variableDeclaration('const', []),
                    )[0]

                    subSetupFn.inheritedScopeVar = {
                      declaration,
                      added: new Set(),
                    }
                  }

                  if (!subSetupFn.inheritedScopeVar.added.has(name)) {
                    subSetupFn.inheritedScopeVar.added.add(name)
                    subSetupFn.inheritedScopeVar.declaration.node.declarations.push(
                      types.variableDeclarator(
                        types.identifier(name),
                        types.callExpression(
                          types.identifier(state.runtimeImport.getImportedSymbol('defineScopeVar', path.scope)),
                          [
                            types.identifier(subSetupFn.ctxParamName),
                            types.stringLiteral(name),
                            types.objectExpression([
                              types.objectProperty(types.identifier('inherited'), types.stringLiteral(name)),
                            ]),
                          ],
                        ),
                      ),
                    )
                  }

                  // NOTE: because `inherit` can cross layers, it's not necessary to add `defineScopeVar` into each middle layer.
                  // but later if passed with `props`, this line shall be removed:
                  break
                }

                const skip = (idPath.node.leadingComments?.some(x => x.value.includes(C_RAW_SCOPE_VAR_POINTER)))
                if (!skip) {
                  idPath.replaceWith(types.memberExpression(
                    types.identifier(name),
                    types.identifier('value'),
                  ))
                }
              }

              const binding = scope.getBinding(name)!
              binding.referencePaths?.forEach(p => p.isIdentifier() && addDotValue(p))

              // patch to avoid weird error
              if (!binding.constant && binding.constantViolations?.length) {
                if (declaration.node.kind === 'const') declaration.node.kind = 'let'
                if (otherScopeVarMeta.isReadonly) throw binding.constantViolations[0].buildCodeFrameError(`${otherScopeVarMeta.isReadonly}: ${name}`)

                binding.constantViolations.forEach((p) => {
                  let identifiers: NodePath<t.Identifier>[] | undefined

                  if (p.isAssignmentExpression()) {
                    identifiers = getIdentifiersFromPattern(p.get('left'))[name]
                  }
                  else if (p.isUpdateExpression()) {
                    const arg = p.get('argument')
                    if (arg.isLVal()) identifiers = getIdentifiersFromPattern(arg)[name]
                  }
                  else if (p.isForInStatement() || p.isForOfStatement()) {
                    const left = p.get('left') as NodePath
                    if (left.isLVal()) identifiers = getIdentifiersFromPattern(left)[name]
                  }

                  if (identifiers) identifiers.forEach(idPath => addDotValue(idPath))
                })
              }
            }
          }

          function transformReturn() {
            const returns = getReturns(path)
            if (!returns.length) throw path.buildCodeFrameError('scope() must return a fragment')
            if (returns.length > 1) throw path.buildCodeFrameError('scope() can only have one return statement')

            const returnPath = returns[0]!
            const renderFn = returnPath.get('argument')
            if (!renderFn.node) throw returnPath.buildCodeFrameError('scope() setup function must return a render function or JSX')

            // if not a render function, wrap it into `() => (expr)`
            if (renderFn.isFunction()) {
              // maybe assume it's a render function
              // TODO: check if it's a render function
            }
            else if (renderFn.isJSXElement() || renderFn.isJSXFragment()) {
              // turn it into a render function
              returnPath.set('argument', types.arrowFunctionExpression([], renderFn.node))
            }
            else {
              // must return a render function or JSX
              throw returnPath.buildCodeFrameError('scope() must return a JSX or render function')
            }

            return returnPath
          }

          function moveHoistedThings(beforeWhere: NodePath) {
            const hoistedDeclaratorNodes = [] as t.VariableDeclarator[]

            const newNames = [] as string[]
            const stubPaths = [] as NodePath<t.Identifier>[]

            const tasks = setupFn.toHoist.splice(0)
            tasks.forEach(({ path, name }) => {
              const newName = getUidInScope(name, path.scope)
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

export default plugin
