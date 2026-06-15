import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeRedirectPath } from "../lib/routes.ts";

test("sanitizeRedirectPath accepts internal paths", () => {
  assert.equal(sanitizeRedirectPath("/teams/join?invite=SL-AB234"), "/teams/join?invite=SL-AB234");
  assert.equal(sanitizeRedirectPath("/setlists#top"), "/setlists#top");
});

test("sanitizeRedirectPath rejects external or executable redirects", () => {
  assert.equal(sanitizeRedirectPath("https://evil.example"), "/setlists");
  assert.equal(sanitizeRedirectPath("//evil.example/path"), "/setlists");
  assert.equal(sanitizeRedirectPath("javascript:alert(1)"), "/setlists");
  assert.equal(sanitizeRedirectPath("/\\evil.example"), "/setlists");
});
