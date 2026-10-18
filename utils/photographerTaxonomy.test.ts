import test from "node:test";
import assert from "node:assert/strict";
import {
  PHOTO_OTHER_CODE, pickableSpecialties, codesForProfile, toggleSpecialtyCode, specialtyProblem, specialtyLabel, optionsFor,
} from "./photographerTaxonomy";
import type { PhotographerTaxonomy } from "@/services/api";

// A small copy of GET /api/taxonomy/photographer (backend #320 + aliases from #324).
const taxonomy: PhotographerTaxonomy = {
  version: 1,
  maxSpecialties: 5,
  otherMax: 500,
  specialties: [
    { code: "photo.weddings", label: "Weddings & engagements", aliases: ["Weddings"] },
    { code: "photo.product", label: "Product", aliases: ["Products", "Food & Product"] },
    { code: "photo.real_estate", label: "Real estate & architecture", aliases: ["Real Estate", "real_estate"] },
    { code: "photo.landscape", label: "Landscape & nature", aliases: ["Nature", "Nature & Landscape"] },
    { code: "photo.concerts", label: "Concerts & nightlife", aliases: ["Concerts"] },
    { code: "photo.sports", label: "Sports" },
    { code: "photo.old", label: "Old", retired: true },
    { code: PHOTO_OTHER_CODE, label: "Other", aliases: ["Other"] },
  ],
  options: { experienceLevel: [{ value: "3_5_years", label: "3 to 5 years" }] },
};

test("retired specialties can't be picked", () => {
  assert.ok(!pickableSpecialties(taxonomy).some((s) => s.code === "photo.old"));
  assert.deepEqual(pickableSpecialties(null), []);
});

test("saved codes win; older names map onto the list; unknown names are skipped", () => {
  assert.deepEqual(codesForProfile(taxonomy, { specialtyCodes: ["photo.sports"], specialties: ["Weddings"] }), ["photo.sports"]);
  assert.deepEqual(
    codesForProfile(taxonomy, { specialties: ["Products", "Concerts", "Real Estate", "nature", "Underwater", "Products"] }),
    ["photo.product", "photo.concerts", "photo.real_estate", "photo.landscape"],
  );
  assert.deepEqual(codesForProfile(taxonomy, { specialties: ["Weddings & engagements"] }), ["photo.weddings"]);
  assert.deepEqual(codesForProfile(null, { specialties: ["Weddings"] }), []);
});

test("never more than the maximum; toggling off works", () => {
  let codes: string[] = [];
  for (const c of ["a", "b", "c", "d", "e", "f"]) codes = toggleSpecialtyCode(codes, c, 5);
  assert.deepEqual(codes, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(toggleSpecialtyCode(codes, "c", 5), ["a", "b", "d", "e"]);
});

test("problems: none picked, Other needs words, Other too long", () => {
  assert.notEqual(specialtyProblem([], "", taxonomy), "");
  assert.match(specialtyProblem([PHOTO_OTHER_CODE], "   ", taxonomy), /Other/);
  assert.match(specialtyProblem([PHOTO_OTHER_CODE], "x".repeat(501), taxonomy), /500/);
  assert.equal(specialtyProblem([PHOTO_OTHER_CODE], "Pet portraits", taxonomy), "");
  assert.equal(specialtyProblem(["photo.sports"], "", taxonomy), "");
});

test("labels and answer choices", () => {
  assert.equal(specialtyLabel(taxonomy, "photo.weddings"), "Weddings & engagements");
  assert.equal(specialtyLabel(taxonomy, "photo.unknown"), "photo.unknown");
  assert.equal(optionsFor(taxonomy, "experienceLevel", [])[0].label, "3 to 5 years");
  assert.equal(optionsFor(null, "experienceLevel", [{ value: "x", label: "X" }])[0].value, "x");
});
