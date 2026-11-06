import React from "react";
import { createRoot } from "react-dom/client";
import { mountProjectWorkspace } from "./project-workspace.jsx";
import { createDemoProjectRepository } from "./project-repository.js";
import { ComponentCatalog } from "./ui/catalog.jsx";

/** Host boundary: a production host can provide its own repository with the same
 * asynchronous contract. This deployment always uses browser-local demo data. */
export function createWorkspace(
  element,
  { repository = createDemoProjectRepository(), ...callbacks } = {},
) {
  let projectHost, catalogRoot;
  return {
    async beforeLeave(route) {
      return projectHost?.beforeLeave ? projectHost.beforeLeave(route) : true;
    },
    getContext() { return projectHost?.getContext() || null; },
    cancelLeave() { projectHost?.cancelLeave(); },
    open(route) {
      if (route.view === "components") {
        projectHost?.dispose();
        projectHost = null;
        catalogRoot ||= createRoot(element);
        catalogRoot.render(
          <ComponentCatalog
            onBack={() => callbacks.onNavigate?.({ view: "projects" })}
          />,
        );
      } else {
        catalogRoot?.unmount();
        catalogRoot = null;
        projectHost ||= mountProjectWorkspace(element, {
          repository,
          ...callbacks,
        });
        projectHost.open(route);
      }
    },
    dispose() {
      projectHost?.dispose();
      catalogRoot?.unmount();
      projectHost = null;
      catalogRoot = null;
    },
  };
}
