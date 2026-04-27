import assert from "node:assert/strict";
import {
  computeSectionTotals,
  getPackageMinimums,
  getTotalMinimum,
  validateMinimums
} from "./packageMinimums.js";

async function runTest(name, assertion) {
  await assertion();
  console.log(`PASS ${name}`);
}

// ── getPackageMinimums ────────────────────────────────────────────────────────

await runTest("returns null when attendeesRange is missing", () => {
  assert.equal(getPackageMinimums("indoor", "birthday", ""), null);
});

await runTest("returns null when venueType is missing", () => {
  assert.equal(getPackageMinimums("", "birthday", "10-30"), null);
});

await runTest("returns null when eventType is missing", () => {
  assert.equal(getPackageMinimums("indoor", "", "10-30"), null);
});

await runTest("returns null for an unrecognised attendees range", () => {
  assert.equal(getPackageMinimums("indoor", "birthday", "999+"), null);
});

// Acceptance criteria — exact matrix values

await runTest("indoor + birthday + 10-30 → total 22", () => {
  const mins = getPackageMinimums("indoor", "birthday", "10-30");
  assert.equal(getTotalMinimum(mins), 22);
});

await runTest("outdoor + birthday + 10-30 → total 22 (same as indoor)", () => {
  const mins = getPackageMinimums("outdoor", "birthday", "10-30");
  assert.equal(getTotalMinimum(mins), 22);
});

await runTest("indoor + birthday + 31-50 → total 43", () => {
  const mins = getPackageMinimums("indoor", "birthday", "31-50");
  assert.equal(getTotalMinimum(mins), 43);
});

await runTest("indoor + birthday + 51-100 → total 83", () => {
  const mins = getPackageMinimums("indoor", "birthday", "51-100");
  assert.equal(getTotalMinimum(mins), 83);
});

await runTest("indoor + party + 51-100 → total 85 (other event type)", () => {
  const mins = getPackageMinimums("indoor", "private-party", "51-100");
  assert.equal(getTotalMinimum(mins), 85);
});

await runTest("indoor + corporate + 51-100 → total 85", () => {
  const mins = getPackageMinimums("indoor", "corporate", "51-100");
  assert.equal(getTotalMinimum(mins), 85);
});

await runTest("indoor + birthday + 101-150 → total 124", () => {
  const mins = getPackageMinimums("indoor", "birthday", "101-150");
  assert.equal(getTotalMinimum(mins), 124);
});

await runTest("indoor + corporate + 101-150 → total 126", () => {
  const mins = getPackageMinimums("indoor", "corporate", "101-150");
  assert.equal(getTotalMinimum(mins), 126);
});

await runTest("indoor + birthday + 150-250 → total 165", () => {
  const mins = getPackageMinimums("indoor", "birthday", "150-250");
  assert.equal(getTotalMinimum(mins), 165);
});

await runTest("indoor + corporate + 150-250 → total 167", () => {
  const mins = getPackageMinimums("indoor", "corporate", "150-250");
  assert.equal(getTotalMinimum(mins), 167);
});

await runTest("outdoor + birthday + 300+ → total 206", () => {
  const mins = getPackageMinimums("outdoor", "birthday", "300+");
  assert.equal(getTotalMinimum(mins), 206);
});

await runTest("outdoor + corporate + 300+ → total 208", () => {
  const mins = getPackageMinimums("outdoor", "corporate", "300+");
  assert.equal(getTotalMinimum(mins), 208);
});

// Screen and custom work are always 0

await runTest("screen minimum is always 0", () => {
  for (const range of ["10-30", "31-50", "51-100", "101-150", "150-250", "300+"]) {
    const mins = getPackageMinimums("indoor", "birthday", range);
    assert.equal(mins.screen, 0, `screen should be 0 for range ${range}`);
  }
});

await runTest("customWorkAndStage minimum is always 0", () => {
  for (const range of ["10-30", "31-50", "51-100", "101-150", "150-250", "300+"]) {
    const mins = getPackageMinimums("indoor", "corporate", range);
    assert.equal(mins.customWorkAndStage, 0, `customWorkAndStage should be 0 for range ${range}`);
  }
});

// ── computeSectionTotals ──────────────────────────────────────────────────────

await runTest("computeSectionTotals counts quantities by builder category", () => {
  const products = [
    { id: 1, builderCategory: "merch" },
    { id: 2, builderCategory: "merch" },
    { id: 3, builderCategory: "giveaways" },
    { id: 4, builderCategory: "sound" },
    { id: 5, builderCategory: "lighting" }
  ];
  const selections = {
    1: { quantity: 10 },
    2: { quantity: 5 },
    3: { quantity: 8 },
    4: { quantity: 3 },
    5: { quantity: 2 }
  };
  const totals = computeSectionTotals(products, selections);
  assert.equal(totals.merch, 15);
  assert.equal(totals.giveaways, 8);
  assert.equal(totals.soundAndLights, 5); // sound + lighting combined
  assert.equal(totals.screen, 0);
  assert.equal(totals.customWorkAndStage, 0);
});

await runTest("computeSectionTotals ignores products with quantity 0", () => {
  const products = [{ id: 1, builderCategory: "merch" }];
  const selections = { 1: { quantity: 0 } };
  const totals = computeSectionTotals(products, selections);
  assert.equal(totals.merch, 0);
});

// ── validateMinimums ──────────────────────────────────────────────────────────

await runTest("validateMinimums returns empty when all sections meet requirements", () => {
  const mins = { merch: 10, giveaways: 10, soundAndLights: 2, screen: 0, customWorkAndStage: 0 };
  const totals = { merch: 10, giveaways: 15, soundAndLights: 3, screen: 0, customWorkAndStage: 0 };
  const violations = validateMinimums(mins, totals);
  assert.equal(violations.length, 0);
});

await runTest("validateMinimums returns violations for sections below minimum", () => {
  const mins = { merch: 40, giveaways: 40, soundAndLights: 5, screen: 0, customWorkAndStage: 0 };
  const totals = { merch: 20, giveaways: 40, soundAndLights: 3, screen: 0, customWorkAndStage: 0 };
  const violations = validateMinimums(mins, totals);
  assert.equal(violations.length, 2);
  assert.equal(violations.find((v) => v.section === "merch")?.required, 40);
  assert.equal(violations.find((v) => v.section === "soundAndLights")?.required, 5);
});

await runTest("validateMinimums skips sections with minimum 0", () => {
  const mins = { merch: 0, giveaways: 0, soundAndLights: 0, screen: 0, customWorkAndStage: 0 };
  const totals = { merch: 0, giveaways: 0, soundAndLights: 0, screen: 0, customWorkAndStage: 0 };
  const violations = validateMinimums(mins, totals);
  assert.equal(violations.length, 0);
});

await runTest("validateMinimums returns empty array when minimums is null", () => {
  const violations = validateMinimums(null, {});
  assert.deepEqual(violations, []);
});

// Checkout gate integration check

await runTest("checkout should pass when all quantities meet minimums (51-100, birthday)", () => {
  const mins = getPackageMinimums("indoor", "birthday", "51-100");
  // merch:40, giveaways:40, soundAndLights:3, screen:0, customWorkAndStage:0
  const totals = { merch: 40, giveaways: 40, soundAndLights: 3, screen: 0, customWorkAndStage: 0 };
  assert.equal(validateMinimums(mins, totals).length, 0);
});

await runTest("checkout should be blocked when merch is below minimum (51-100, party)", () => {
  const mins = getPackageMinimums("indoor", "private-party", "51-100");
  // merch:40, giveaways:40, soundAndLights:5
  const totals = { merch: 39, giveaways: 40, soundAndLights: 5, screen: 0, customWorkAndStage: 0 };
  const violations = validateMinimums(mins, totals);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].section, "merch");
});
