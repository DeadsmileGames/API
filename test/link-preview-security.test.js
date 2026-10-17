import test from "node:test";
import assert from "node:assert/strict";
import { isPublicAddress } from "../src/utils/linkPreview.js";

test("public address guard accepts ordinary public IPv4 and IPv6 addresses", () => {
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2001:4860:4860::8888"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("public address guard rejects non-public and special-use IPv4 addresses", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("public address guard rejects IPv6 local, documentation and transition ranges", () => {
  for (const address of [
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001::1",
    "2001:db8::1",
    "2002:c000:0201::1",
    "3fff::1",
    "ff02::1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("public address guard fails closed on malformed addresses", () => {
  for (const address of ["", "not-an-ip", "2001::gggg", "8.8.8.8.example"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});
