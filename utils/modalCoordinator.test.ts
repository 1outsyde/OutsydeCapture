import test from "node:test";
import assert from "node:assert/strict";
import {
  closeModal,
  isAnyOpen,
  isAnyOpenExcept,
  openModal,
} from "./modalCoordinator";

test("isAnyOpenExcept ignores only its own key", () => {
  assert.equal(isAnyOpenExcept("plan-offer"), false);
  openModal("plan-offer");
  assert.equal(isAnyOpen(), true);
  assert.equal(isAnyOpenExcept("plan-offer"), false);
  openModal("eligibility-gate");
  assert.equal(isAnyOpenExcept("plan-offer"), true);
  closeModal("eligibility-gate");
  closeModal("plan-offer");
  assert.equal(isAnyOpen(), false);
});
