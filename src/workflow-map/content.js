// Customer-facing workflow content. Source paths are repository-relative;
// demo links are relative to the /workflows/ page.
// Roles identify the person acting in the workflow, not access permissions.
// A host-level note explains the fictional, browser-local demonstration once.

export const journey = [
  {
    id: 'understand',
    title: 'Understand the product',
    summary: 'Start with the detail that matters.',
    steps: [
      {
        id: 'explore-product',
        label: 'Explore the product',
        role: 'buyer',
        detail: 'Inspect the model in the existing viewer and find the area you want to discuss.',
      },
      {
        id: 'select-component',
        label: 'Select a component',
        role: 'buyer',
        detail: 'Choose the part and adjust the camera to show your point.',
      },
      {
        id: 'keep-reference',
        label: 'Ask from this view',
        role: 'buyer',
        detail: 'Open an inquiry with the selected part, exact camera and product version attached.',
        outcome: 'One clear reference travels with the project.',
      },
    ],
  },
  {
    id: 'quotation',
    title: 'Get a quotation',
    summary: 'Turn a requirement into reviewed scope.',
    steps: [
      {
        id: 'describe-requirement',
        label: 'Describe the requirement',
        role: 'buyer',
        detail: 'Explain the application, quantity and scope you need. Keep browsing without losing the draft.',
      },
      {
        id: 'confirm-inquiry',
        label: 'Review, then confirm inquiry',
        role: 'buyer',
        detail: 'Check the full request and attached reference before a separate confirmation.',
        gate: 'Review, then confirm',
      },
      {
        id: 'issue-v1',
        label: 'Prepare and issue quotation v1',
        role: 'seller',
        detail: 'Define the offered scope and terms, review the complete quotation, then explicitly issue v1.',
        gate: 'Review, then issue',
        outcome: 'Only the issued version appears to the buyer, tied to the original request.',
      },
    ],
  },
  {
    id: 'resolve',
    title: 'Resolve & move forward',
    summary: 'Resolve any changes and agree on the next action.',
    optionalPath: {
      label: 'No change needed?',
      detail: 'Go directly from quotation v1 to agreeing on the next step. The walkthrough shows a revision as one possible path.',
      from: 'issue-v1',
      to: 'agree-next-step',
    },
    steps: [
      {
        id: 'request-change',
        label: 'Request a change to v1',
        role: 'buyer',
        detail: 'If a change is needed, describe it, review the request, then explicitly confirm it. Otherwise, go straight to agreeing on the next step.',
        gate: 'Review and confirm change',
      },
      {
        id: 'issue-v2',
        label: 'Prepare and issue quotation v2',
        role: 'seller',
        detail: 'Address the confirmed change in a new draft. Review the revised quotation before explicitly issuing v2.',
        gate: 'Review, then issue v2',
        outcome: 'The original inquiry and v1 remain unchanged.',
      },
      {
        id: 'compare-versions',
        label: 'Compare both versions',
        role: 'buyer',
        detail: 'Check the changed scope and terms. Reopen the exact saved reference for either quotation.',
      },
      {
        id: 'agree-next-step',
        label: 'Agree on the next step',
        role: 'shared',
        detail: 'The buyer reviews and confirms an engineering-discussion request. The seller separately reviews and acknowledges it.',
        gate: 'Separate buyer and seller confirmations',
        outcome: 'An acknowledged next step, with the project context intact.',
      },
    ],
  },
];

export const branches = [
  {
    id: 'contextual-inquiry',
    title: 'Ask about a specific detail',
    summary: 'Keep the exact reference while turning a product question into an inquiry.',
    audience: 'Buyer',
    steps: [
      { label: 'Inspect a part and open an inquiry', role: 'buyer' },
      { label: 'Attach the view and describe the requirement', role: 'buyer' },
      { label: 'Review the complete request', role: 'buyer' },
      { label: 'Explicitly confirm the inquiry', role: 'buyer' },
      { label: 'Reopen the saved reference and return to the same record', role: 'buyer' },
    ],
    rules: [
      'Minimize and resume the same draft. Browsing another part does not replace its attached reference.',
      'Replacing a reference is explicit. Editing reviewed input requires another review; a failed save keeps the input for retry.',
      'The independent viewer example supports selected parts and exact camera views. It does not support drawings, mechanism animation or guided stories.',
      'Prepared Product Room examples can also use saved inspections and story steps; drawing details require confirmed product associations.',
    ],
    sourceDoc: 'docs/exploration-to-quote-review.md',
    demoHref: '../integrations/existing-viewer/',
  },
  {
    id: 'clarify-scope',
    title: 'Clarify preferences and offered scope',
    summary: 'Use optional alternatives and component questions to make the quotation specific.',
    audience: 'Buyer + seller',
    steps: [
      { label: 'Start with a confirmed component request', role: 'buyer' },
      { label: 'Optionally compare alternatives or ask component questions', role: 'buyer' },
      { label: 'Review and confirm preferences or replies; resolve scope questions', role: 'shared' },
      { label: 'Explicitly adopt the current preference and question evidence', role: 'seller' },
      { label: 'Map requests to quotation lines', role: 'seller' },
      { label: 'Review the full scope, then explicitly issue the quotation', role: 'seller' },
    ],
    rules: [
      'Use alternatives, questions or both when needed. This separate qualified example offers two prepared support packages for the same geometry, without automatic pricing.',
      'A reply does not resolve a question. Seller resolution is a separate reviewed confirmation, not buyer acceptance. Relevant unresolved scope questions block issue and next-step confirmation; informational questions may stay open.',
      'Each request must be included, clarified or excluded with an explanation. One request can map to several quotation lines.',
      'New preferences and replies do not silently update a draft. Issued quotations preserve the scope and evidence reviewed for that version.',
    ],
    sourceDoc: 'docs/option-scope-review.md',
    demoHref: '../product-room/?optionDemo=crank-options-v1',
  },
  {
    id: 'drawing-change',
    title: 'Review a drawing change',
    summary: 'Decide what moves to a new reference while preserving the original inquiry and quotation.',
    audience: 'Seller + buyer',
    steps: [
      { label: 'Inspect candidate drawing B and identify affected work', role: 'seller' },
      { label: 'Review each reference: retain A or confirm the detail on B', role: 'seller' },
      { label: 'Review all decisions, then explicitly apply them', role: 'seller' },
      { label: 'Review scope and terms, then review and issue quotation v2', role: 'seller' },
      { label: 'Compare v1 and v2 with their exact drawing references', role: 'buyer' },
    ],
    rules: [
      'This separate SK08 example changes document layout and a review note. It does not certify a manufacturing-design change or engineering equivalence.',
      'Missing or uncertain links require a decision. Different items can deliberately retain different drawing versions.',
      'Applying impact decisions updates working references; it does not rewrite commercial terms or issue a quotation.',
      'Scope can be omitted with an explanation; questions cannot be omitted through this review. Original inquiry and question history remain on A.',
    ],
    sourceDoc: 'docs/drawing-impact-review.md',
    demoHref: '../studio/?impactDemo=sk08-a-b-v1',
  },
  {
    id: 'prepare-product',
    title: 'Prepare and publish a product',
    summary: 'Turn prepared source files into a reviewed product package and a verified public release.',
    audience: 'Product owner + deployment owner',
    steps: [
      'Prepare model and source files; check identity, units and rights',
      'Confirm part and drawing links; configure supported views and inquiry',
      'Save and preview the exact product package',
      'Review, explicitly confirm and export the package',
      'Apply the package, validate and deploy',
      'Verify the published Product Room',
    ],
    rules: [
      'The prepared NEMA 17 bracket is a separate onboarding example. CAD conversion, source qualification and technical views still need preparation.',
      'Studio confirmation creates a reviewed local package. Public release requires deployment and verification of the target website.',
      'New projects use the published release. Existing projects keep their pinned product and document versions.',
      'Confirming a drawing association verifies its reference; it is not manufacturing approval.',
    ],
    sourceDoc: 'docs/w41-product-onboarding-review.md',
    demoHref: '../studio/#onboard',
  },
  {
    id: 'connect-viewer',
    title: 'Connect an existing viewer',
    summary: 'Keep the customer’s viewer and carry exact product context into the project workflow.',
    audience: 'Integration team',
    steps: [
      'Inventory supported viewing capabilities and stable product/part identities',
      'Implement exact view capture and restore',
      'Connect compatible project storage and mount the inquiry',
      'Test review, confirmation, reference restore and recovery',
      'Qualify the standalone host',
      'Connect buyer and seller workspaces; verify the full journey',
    ],
    rules: [
      'The customer owns rendering, camera and selection. Annora carries an exact, versioned reference through the adapter.',
      'Missing historical models and unsupported actions must fail clearly, without substituting the latest view or version.',
      'One independent viewer is qualified. Each additional viewer needs its own adapter checks and supported-capability agreement.',
      'The inquiry host is independently installable. The optional commercial walkthrough joins same-origin Product Room and Studio pages; it is not a complete portable seller application.',
    ],
    sourceDoc: 'docs/integration-kit.md',
    demoHref: '../integrations/existing-viewer/',
  },
];
