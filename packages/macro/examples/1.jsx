import { scope, scopeFor, scopeVar } from "hey-stack-macro";

// Note: each fragment can seamless treat as a new "scope"
// because "scope" inherits all variables from ascendent

const Page = scope(() => {
  return (
    <div>
      <div> welcome! dear {user.name} </div>
      {scope(() => {
        const items = scopeVar(xxxxx);
        onMount(() => {
          /* do something */
        });

        return (
          <>
            <div> we got {items.length} items </div>

            {scopeFor(items, (item, key, items) => {
              const hash = scopeVar.computed.private(objectHash(item));
              return (
                <section>
                  <div> {item.name} </div>
                  <div> {item.age} </div>
                  <div> {hash} </div>
                </section>
              );
            })}
          </>
        );
      })}
    </div>
  );
});
