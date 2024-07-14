declare module 'hey-stack-framework' {
  import type { MaybePromise, ScopeCtx, ScopeForPropsBase, ScopeSetupOptionsBase } from 'hey-stack-core'
  import type { JSX } from 'react/jsx-runtime'

  export * from 'hey-stack-core'

  export type FrameworkComponent<Props = any> = (props: Props) => JSX.Element
  export type ScopeComponentSetupFn = (scopeCtx: ScopeCtx) => MaybePromise<() => JSX.Element>
  export type ScopeForProps = ScopeForPropsBase<FrameworkComponent>
  export type ScopeSetupOptions = ScopeSetupOptionsBase<FrameworkComponent>

  export function defineScopeComponent(setupFn: ScopeComponentSetupFn): FrameworkComponent
  export const ScopeForRenderer: FrameworkComponent<ScopeForProps>
}
