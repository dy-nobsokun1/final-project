import assert from "node:assert/strict";
import { after, test } from "node:test";

// services/bakong.js loads config.js, which requires these. No network or database is used:
// fetch is replaced below.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "unused";
const { buildKhqr, crc16, khqrMd5, khqrPaysAccount, toAsciiName } = await import("../src/utils/khqr.js");
const { checkBakongReachable, isKhqrPaid } = await import("../src/services/bakong.js");
const { isBakongAccountId } = await import("../src/utils/validation.js");

test("CRC-16 gives the standard check value for CRC-16/CCITT-FALSE", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("a KHQR matches, character for character, the National Bank's own library (bakong-khqr 1.0.20)", () => {
  const createdAt = new Date(1792500000000);
  const qr = (amount) => buildKhqr({
    accountId: "sokunth@aclb",
    receiverName: "Sokunth",
    amount,
    billNumber: "UNISWAP-1a2b3c4d",
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
  });
  // Made by the official library's generateIndividual() with the same inputs and clock.
  assert.equal(qr(25), "00020101021229160012sokunth@aclb5204599953038405402255802KH5907Sokunth"
    + "6010Phnom Penh62310116UNISWAP-1a2b3c4d0307UniSwap993400131792500000000011317925018000006304B1CC");
  assert.equal(qr(12.5), "00020101021229160012sokunth@aclb520459995303840540512.505802KH5907Sokunth"
    + "6010Phnom Penh62310116UNISWAP-1a2b3c4d0307UniSwap993400131792500000000011317925018000006304F7E5");
  assert.equal(khqrMd5(qr(12.5)), "89b45f48f9b58a4cfb55242173301f70");

  // Which account a stored QR pays: the exact ID, not one that merely starts the same way.
  assert.equal(khqrPaysAccount(qr(25), "sokunth@aclb"), true);
  assert.equal(khqrPaysAccount(qr(25), "sokunth@acl"), false);
  assert.equal(khqrPaysAccount(qr(25), "someone@aclb"), false);
});

test("names in the QR are plain ASCII, at most 25 characters, never empty", () => {
  assert.equal(toAsciiName("Sophéa Chéa"), "Sophea Chea");
  assert.equal(toAsciiName("សុខា"), "UniSwap seller");
  assert.equal(toAsciiName("A very long student name that goes on"), "A very long student name");
});

test("Bakong account IDs look like name@bank and fit in a KHQR", () => {
  for (const id of ["sokunth@aclb", "012345678@wing", "long.vathanak_1@abaa"]) assert.equal(isBakongAccountId(id), true, id);
  for (const id of ["sokunth", "@aclb", "sok unth@aclb", "a@b.c", `${"x".repeat(30)}@aclb`, null]) {
    assert.equal(isBakongAccountId(id), false, String(id));
  }
});

test("Bakong's answer: paid, not paid yet, failed, and a refused (non-Cambodian) IP address", async () => {
  const realFetch = globalThis.fetch;
  after(() => { globalThis.fetch = realFetch; });
  const answer = (body, status = 200) => { globalThis.fetch = async () => Response.json(body, { status }); };

  answer({ responseCode: 0, data: { hash: "abc", amount: 25 } });
  assert.equal(await isKhqrPaid("any qr"), true);
  answer({ responseCode: 1, errorCode: 1, responseMessage: "Transaction could not be found." });
  assert.equal(await isKhqrPaid("any qr"), false);
  answer({ responseCode: 1, errorCode: 3, responseMessage: "Transaction failed." });
  assert.equal(await isKhqrPaid("any qr"), false);
  answer({ error: "forbidden" }, 403);
  await assert.rejects(isKhqrPaid("any qr"), /Cambodian IP/);
  answer({ responseCode: 1, errorCode: 6, responseMessage: "Unauthorized" });
  await assert.rejects(isKhqrPaid("any qr"), /Unauthorized.*wrong or has expired/);
  answer({ error: "unauthorized" }, 401);
  await assert.rejects(isKhqrPaid("any qr"), /BAKONG_TOKEN is wrong or has expired/);
});

test("before showing a QR, the API checks that Bakong answers at all", async () => {
  const realFetch = globalThis.fetch;
  after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => Response.json({ responseCode: 1, errorCode: 1, responseMessage: "Transaction could not be found." });
  await checkBakongReachable(); // answered "not paid": reachable
  globalThis.fetch = async () => Response.json({ error: "forbidden" }, { status: 403 });
  await assert.rejects(checkBakongReachable(), /Cambodian IP/);
});
