import assert from "node:assert/strict";
import {
  buildAuthPath,
  buildReturnToFromLocation,
  getAuthRedirectPath,
  resolvePostAuthPath,
  shouldShowCartIcon
} from "./authNavigation.js";

function runTest(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("should hide cart icon for signed-out users and show it for signed-in users", () => {
  assert.equal(shouldShowCartIcon(false), false);
  assert.equal(shouldShowCartIcon(true), true);
});

runTest("should build sign-in auth paths with protected return destinations", () => {
  assert.equal(buildAuthPath(), "/auth?tab=signin");
  assert.equal(buildAuthPath("/ai-planner"), "/auth?tab=signin&returnTo=%2Fai-planner");
  assert.equal(buildAuthPath("/shop?category=Stages#featured"), "/auth?tab=signin&returnTo=%2Fshop%3Fcategory%3DStages%23featured");
});

runTest("should resolve post-auth return paths safely", () => {
  assert.equal(resolvePostAuthPath("Profile.html"), "/profile");
  assert.equal(resolvePostAuthPath("/ai-planner"), "/ai-planner");
  assert.equal(resolvePostAuthPath("https://example.com"), "/");
  assert.equal(resolvePostAuthPath("//example.com"), "/");
  assert.equal(resolvePostAuthPath(""), "/");
});

runTest("should derive a return path from the current location", () => {
  assert.equal(
    buildReturnToFromLocation({
      pathname: "/shop",
      search: "?category=Stages",
      hash: "#featured"
    }),
    "/shop?category=Stages#featured"
  );
});

runTest("should only redirect protected access for signed-out users", () => {
  assert.equal(
    getAuthRedirectPath({
      isAuthenticated: false,
      location: { pathname: "/ai-planner", search: "", hash: "" }
    }),
    "/auth?tab=signin&returnTo=%2Fai-planner"
  );

  assert.equal(
    getAuthRedirectPath({
      isAuthenticated: true,
      location: { pathname: "/ai-planner", search: "", hash: "" }
    }),
    null
  );
});
