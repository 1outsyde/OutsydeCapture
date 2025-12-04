import React from "react";
// @ts-nocheck - Intentional crash for testing error boundary
export default function CrashScreen() {
  const undefinedVariable = someUndefinedVariable.property;
  return <>{undefinedVariable}</>;
}
