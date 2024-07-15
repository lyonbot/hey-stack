import { defineScopeComponent, defineScopeVar, ScopeForRenderer } from "hey-stack-framework";

const randomDelay = () => new Promise((resolve) => setTimeout(resolve, Math.round(200 + Math.random() * 500)));

export const App = defineScopeComponent((ctx) => {
  const names = defineScopeVar(ctx, "names", {
    value: ["John", "Jane", "Joe", "Jack", "Jill", "Jim", "Joey", "Johnny", "Jon", "Jerry"],
  });

  const child = defineScopeComponent(async (ctx) => {
    await randomDelay();
    const name = defineScopeVar(ctx, "name", { inherited: "name" });

    return () => (
      <div>
        <h2>{name.value}</h2>
      </div>
    );
  });

  return () => (
    <div>
      <ScopeForRenderer items={names} childComponent={child} as="name" />
    </div>
  );
});
