<script lang="ts">
  import Projects from "./routes/Projects.svelte";
  import ProjectEdit from "./routes/ProjectEdit.svelte";
  import ProfilePage from "./routes/Profile.svelte";
  import Tailor from "./routes/Tailor.svelte";
  import { parseHash, routeToHash, type Route } from "./lib/router";

  let route = $state<Route>(parseHash(location.hash));

  // Keep hash in sync when we navigate programmatically.
  $effect(() => {
    const target = routeToHash(route);
    if (location.hash !== target) {
      history.replaceState(null, "", target);
    }
  });

  // Sync route from hash on back/forward and external edits.
  $effect(() => {
    const onHash = () => {
      const next = parseHash(location.hash);
      const cur = routeToHash(route);
      const nextHash = routeToHash(next);
      if (cur !== nextHash) route = next;
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });

  function go(r: Route) {
    route = r;
  }
</script>

<div class="app">
  <h1 class="brand">
    magi<span class="brand-cv">CV</span>
  </h1>
  <nav class="tabs">
    <button
      class:active={route.name === "tailor"}
      onclick={() => go({ name: "tailor" })}
    >
      Tailor
    </button>
    <button
      class:active={route.name === "projects" || route.name === "project"}
      onclick={() => go({ name: "projects" })}
    >
      Projects
    </button>
    <button
      class:active={route.name === "profile"}
      onclick={() => go({ name: "profile" })}
    >
      Profile
    </button>
  </nav>

  {#if route.name === "tailor"}
    <Tailor />
  {:else if route.name === "projects"}
    <Projects
      onEdit={(id) => go({ name: "project", id })}
      onNew={() => go({ name: "project", id: null })}
    />
  {:else if route.name === "project"}
    <ProjectEdit id={route.id} onBack={() => go({ name: "projects" })} />
  {:else if route.name === "profile"}
    <ProfilePage />
  {/if}
</div>
