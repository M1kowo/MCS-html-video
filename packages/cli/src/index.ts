// Programmatic API surface
export { bootstrap, findProjectRoot } from './context.js';
export type { CliContext } from './context.js';
export { startStudioServer } from './studio-server.js';
export { getDesignContext, getDesignPlan, validateDesignPlan, writeDesignPlan } from './design-plan.js';
export type { DesignPlan, SimilarityReport } from './design-plan.js';
export { COMPONENT_CATALOG, DESIGN_PRINCIPLES, STYLE_PACKS } from './design-library.js';
export { assessHtmlVisualBeats, assessProjectVisualVariety, assertProjectVisualVariety } from './visual-variety.js';
export type { VisualVarietyReport } from './visual-variety.js';
