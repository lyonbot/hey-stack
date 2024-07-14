import { defineScopeComponent, defineScopeVar, ScopeForRenderer } from "hey-stack-framework";

export const App = defineScopeComponent((ctx) => {
  const foo = defineScopeVar(ctx, "foo", { value: 0 });
  const bar = defineScopeVar(ctx, "bar", { value: 0, private: true });
  const baz = defineScopeVar(ctx, "baz", { value: 0, exposeAs: "val3" });

  return () => (
    <div>
      <h1>
        Value is [foo = {foo.value}] [bar = {bar.value}] [baz = {baz.value}]
      </h1>
      <button onClick={() => bar.value++}>Plus bar</button>
      <button onClick={() => baz.value++}>Plus baz</button>

      <p>
        <small>bar is not inheritable! baz is exposed as "val3"!</small>
      </p>

      <hr />

      <Child />
    </div>
  );
});

const Child = defineScopeComponent((ctx) => {
  const foo = defineScopeVar(ctx, "foo", { inherited: "foo" });
  const bar = defineScopeVar(ctx, "bar", { inherited: "bar" });
  const baz = defineScopeVar(ctx, "baz", { inherited: "baz" });
  const val3 = defineScopeVar(ctx, "val3", { inherited: "val3" });

  return () => (
    <fieldset>
      <legend>Child</legend>
      <h2>
        [foo = {foo.value}] [bar = {bar.value}] [baz = {baz.value}] [val3 = {val3.value}]
      </h2>
      <button onClick={() => foo.value++}>Plus foo</button>
      <button onClick={() => bar.value++}>Plus bar (shall fail)</button>
      <button onClick={() => baz.value++}>Plus baz (shall fail)</button>
      <button onClick={() => val3.value++}>Plus val3 (shall affect parent's baz)</button>
    </fieldset>
  );
});
