import { defineScopeComponent, defineScopeVariable, ScopeFor } from "hey-stack-framework";

export const App = defineScopeComponent((ctx) => {
  defineScopeVariable(ctx, "foo", { value: 0 });
  defineScopeVariable(ctx, "bar", { value: 0, private: true });
  defineScopeVariable(ctx, "baz", { value: 0, exposeAs: "val3" });

  return () => (
    <div>
      <h1>
        Value is [{ctx.foo}] [{ctx.bar}] [{ctx.baz}] [{ctx.val3}]
      </h1>
      <button onClick={() => ctx.bar++}>Plus bar</button>
      <button onClick={() => ctx.baz++}>Plus baz</button>

      <hr />

      <Child />
    </div>
  );
});

const Child = defineScopeComponent((ctx) => {
  return () => (
    <fieldset>
      <legend>Child</legend>
      <h2>
        Value is [{ctx.foo}] [{ctx.bar}] [{ctx.baz}] [{ctx.val3}]
      </h2>
      <button onClick={() => ctx.foo++}>Plus foo</button>
      <button onClick={() => ctx.bar++}>Plus bar from child (not defined in child)</button>
      <button onClick={() => ctx.val3++}>Plus val3</button>
    </fieldset>
  );
});
