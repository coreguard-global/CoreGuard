/**
 * Type-level smoke for the Agent Commerce declaration surface (AC-SDK/1).
 *
 * This file exists ONLY to give the CI `tsc --noEmit` lane something to check:
 * the committed `index.d.ts` declaration surface must compile as a real module
 * surface, not merely exist as text. It imports the declarations and pins their
 * shapes into type positions — any drift in a declared name, an interface or a
 * union fails the build. It performs no runtime checks and imports nothing at
 * runtime.
 */

import type {
  AgrClass,
  ConsentIntent,
  ConsentPolicy,
  ConsentReceipt,
  ConsentRecord,
  DeclaredTrace,
  EngineVerification,
  ExecutionVerdict,
  RiskReport,
  RiskViolation,
} from "./index";

export type AgentCommerceDeclarationSurface = readonly [
  ConsentRecord,
  ExecutionVerdict,
  RiskReport,
  ConsentReceipt,
  EngineVerification,
  AgrClass,
  RiskViolation,
  ConsentIntent,
  DeclaredTrace,
  ConsentPolicy,
];
