// The admin role: who may use /api/admin, what it answers, and that moderation follows the owner's
// delete rules exactly (db/deleteListing.js).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());

/** A normal student, then made an admin in the database, as `npm run db:make-admin` does. */
async function createAdmin() {
  const admin = await api.createUser("Test Admin");
  await api.sql("UPDATE users SET role = 'admin' WHERE id = $1", [admin.id]);
  return admin;
}

const ADMIN_PATHS = [
  ["GET", "/api/admin/overview"],
  ["GET", "/api/admin/users"],
  ["DELETE", `/api/admin/listings/${randomUUID()}`],
];

test("admin routes need a login (401) and the admin role (403)", async () => {
  const student = await api.createUser();
  for (const [method, path] of ADMIN_PATHS) {
    assert.equal((await api.request(method, path)).status, 401, path);
    const refused = await api.request(method, path, { token: student.token });
    assert.equal(refused.status, 403, path);
    assert.equal(refused.body.error, "Admins only.");
  }
});

test("the role is read from the database: it works and stops working at once, same token", async () => {
  const person = await api.createUser();
  assert.equal((await api.request("GET", "/api/admin/overview", { token: person.token })).status, 403);
  await api.sql("UPDATE users SET role = 'admin' WHERE id = $1", [person.id]);
  assert.equal((await api.request("GET", "/api/admin/overview", { token: person.token })).status, 200);
  await api.sql("UPDATE users SET role = 'student' WHERE id = $1", [person.id]);
  assert.equal((await api.request("GET", "/api/admin/overview", { token: person.token })).status, 403);
});

test("the role shows on /api/auth/me, never on a public profile", async () => {
  const [student, admin] = await Promise.all([api.createUser(), createAdmin()]);
  assert.equal((await api.request("GET", "/api/auth/me", { token: student.token })).body.user.role, "student");
  assert.equal((await api.request("GET", "/api/auth/me", { token: admin.token })).body.user.role, "admin");
  const profile = (await api.request("GET", `/api/users/${admin.id}`)).body.user;
  assert.equal(profile.role, undefined);
  assert.equal(profile.email, undefined);
});

test("overview counts users, listings, messages and payments as numbers", async () => {
  const admin = await createAdmin();
  const seller = await api.createUser();
  await api.createListing(seller, { title: "Overview giveaway", listingType: "giveaway", price: 0 });
  const response = await api.request("GET", "/api/admin/overview", { token: admin.token });
  assert.equal(response.status, 200);
  const { users, listings, messages, payments, lastSevenDays } = response.body.overview;
  assert.ok(users.verified >= 2 && users.admins >= 1);
  assert.equal(typeof users.unverified, "number");
  assert.ok(listings.total >= 1 && listings.byStatus.active >= 1 && listings.byType.giveaway >= 1);
  assert.equal(typeof messages, "number");
  assert.equal(typeof payments.paid, "number");
  assert.equal(typeof payments.paidTotal, "number");
  assert.ok(lastSevenDays.newUsers >= 2 && lastSevenDays.newListings >= 1);
});

test("users list: newest first, with emails, roles and listing counts; limit 1-100", async () => {
  const admin = await createAdmin();
  const seller = await api.createUser();
  await api.createListing(seller);
  // Other test files add users at the same time, so look the seller up instead of assuming it is first.
  const response = await api.request("GET", "/api/admin/users?limit=100", { token: admin.token });
  assert.equal(response.status, 200);
  const { users } = response.body;
  const times = users.map((user) => Date.parse(user.createdAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
  const found = users.find((user) => user.id === seller.id);
  assert.deepEqual(Object.keys(found).sort(),
    ["createdAt", "email", "id", "isVerified", "listingCount", "name", "role"]);
  assert.equal(found.email, seller.email);
  assert.equal(found.role, "student");
  assert.equal(found.isVerified, true);
  assert.equal(found.listingCount, 1);

  const one = await api.request("GET", "/api/admin/users?limit=1", { token: admin.token });
  assert.equal(one.body.users.length, 1);
  const many = await api.request("GET", "/api/admin/users?limit=500", { token: admin.token });
  assert.ok(many.body.users.length <= 100);
});

test("an admin removes another student's active listing: 204, then it is gone (404)", async () => {
  const [admin, seller] = await Promise.all([createAdmin(), api.createUser()]);
  const listing = await api.createListing(seller);
  const path = `/api/admin/listings/${listing.id}`;
  assert.equal((await api.request("DELETE", path, { token: admin.token })).status, 204);
  assert.equal((await api.request("GET", `/api/listings/${listing.id}`)).status, 404);
  assert.equal((await api.request("DELETE", path, { token: admin.token })).status, 404);
  assert.equal((await api.request("DELETE", "/api/admin/listings/not-a-uuid", { token: admin.token })).status, 404);
});

test("an admin gets the owner's 409s: sold, traded, reserved, reviewed or paid listings stay", async () => {
  const [admin, seller, buyer] = await Promise.all([createAdmin(), api.createUser(), api.createUser()]);
  const refused = async (listingId, why) => {
    const response = await api.request("DELETE", `/api/admin/listings/${listingId}`, { token: admin.token });
    assert.equal(response.status, 409, why);
    assert.equal((await api.request("GET", `/api/listings/${listingId}`)).status, 200, why);
  };

  for (const status of ["sold", "traded"]) {
    const listing = await api.createListing(seller);
    await api.request("PATCH", `/api/listings/${listing.id}`, { token: seller.token, body: { status } });
    await refused(listing.id, status);
  }

  const reserved = await api.createListing(seller);
  await api.sql("UPDATE listings SET status = 'reserved', reserved_for = $2 WHERE id = $1", [reserved.id, buyer.id]);
  await refused(reserved.id, "reserved");

  const reviewed = await api.createListing(seller);
  await api.sql(
    "INSERT INTO reviews (listing_id, reviewer_id, reviewee_id, rating) VALUES ($1, $2, $3, 5)",
    [reviewed.id, buyer.id, seller.id],
  );
  await refused(reviewed.id, "reviewed");

  const pending = await api.createListing(seller);
  await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 25, $3)",
    [pending.id, buyer.id, `cs_test_admin_${randomUUID()}`],
  );
  await refused(pending.id, "unconfirmed payment");
});
