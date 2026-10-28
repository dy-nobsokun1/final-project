import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());
const { UPLOAD_DIR } = await import("../../src/routes/uploads.js");

/** A URL our upload route could have returned. Only the URL is checked, so no file is needed. */
const ownPhoto = () => `${api.baseUrl}/uploads/${randomUUID()}.jpg`;
const ownPhotos = (count) => Array.from({ length: count }, ownPhoto);

// The smallest valid PNG: one transparent pixel.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

function post(user, imageUrls) {
  return api.request("POST", "/api/listings", {
    token: user.token,
    body: { title: "Photo test", category: "textbooks", condition: "good", price: 5, imageUrls },
  });
}

function patch(user, listingId, imageUrls) {
  return api.request("PATCH", `/api/listings/${listingId}`, { token: user.token, body: { imageUrls } });
}

async function photosOf(listingId) {
  return (await api.request("GET", `/api/listings/${listingId}`)).body.listing.imageUrls;
}

test("a listing keeps up to 6 photos in the order sent; the first is the cover", async () => {
  const seller = await api.createUser();
  const photos = ownPhotos(6);
  const listing = await api.createListing(seller, { imageUrls: photos });

  assert.deepEqual(listing.imageUrls, photos);
  assert.deepEqual(await photosOf(listing.id), photos);
});

test("more than 6 photos, the same photo twice, or anything but a list of text is refused", async () => {
  const seller = await api.createUser();
  const photo = ownPhoto();
  for (const imageUrls of [ownPhotos(7), [photo, photo], [42], "not-a-list"]) {
    const response = await post(seller, imageUrls);
    assert.equal(response.status, 400, JSON.stringify(imageUrls));
    assert.deepEqual(Object.keys(response.body.details), ["imageUrls"]);
  }

  const listing = await api.createListing(seller, { imageUrls: [photo] });
  assert.equal((await patch(seller, listing.id, ownPhotos(7))).status, 400);
  assert.deepEqual(await photosOf(listing.id), [photo]);
});

test("a new photo must be one of UniSwap's own uploads", async () => {
  const seller = await api.createUser();
  for (const url of [
    `https://tracker.example.com/uploads/${randomUUID()}.jpg`,
    `${api.baseUrl}/uploads/../package.json`,
    `${api.baseUrl}/uploads/${randomUUID()}.jpg?who=you`,
    `${api.baseUrl}/uploads/${randomUUID()}.svg`,
    "/listings/bike.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
  ]) {
    const response = await post(seller, [url]);
    assert.equal(response.status, 400, url);
    assert.equal(response.body.details.imageUrls, "Photos must be uploaded through UniSwap.");
  }
});

test("an edit can keep, reorder and remove the photos a listing already has, but not add or bring back outside ones", async () => {
  const seller = await api.createUser();
  const { id } = await api.createListing(seller);
  // Like the demo listings in db-seed.js: pictures that are not uploads.
  const old = ["/listings/bike.jpg", "/listings/bike.svg"];
  await api.sql("UPDATE listings SET image_urls = $1 WHERE id = $2", [old, id]);

  const reordered = [old[1], ownPhoto(), old[0]];
  const response = await patch(seller, id, reordered);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.listing.imageUrls, reordered);

  // Another outside picture is refused, even next to the ones the listing has.
  assert.equal((await patch(seller, id, [old[1], old[0], "/listings/desk.svg"])).status, 400);

  // Removing every photo is fine, but a removed outside picture cannot come back.
  assert.deepEqual((await patch(seller, id, [])).body.listing.imageUrls, []);
  assert.equal((await patch(seller, id, ["/listings/bike.jpg"])).status, 400);
});

test("a photo from POST /api/uploads can go straight into a listing", async () => {
  const seller = await api.createUser();
  const upload = (token, contentType) => fetch(`${api.baseUrl}/api/uploads`, {
    method: "POST",
    headers: { "Content-Type": contentType, ...(token && { Authorization: `Bearer ${token}` }) },
    body: ONE_PIXEL_PNG,
  });

  assert.equal((await upload(null, "image/png")).status, 401);
  assert.equal((await upload(seller.token, "application/pdf")).status, 400);

  const response = await upload(seller.token, "image/png");
  assert.equal(response.status, 201);
  const { url } = await response.json();
  try {
    assert.ok(url.startsWith(`${api.baseUrl}/uploads/`), url);
    assert.ok(url.endsWith(".png"), url);
    assert.equal((await fetch(url)).status, 200);

    const listing = await api.createListing(seller, { imageUrls: [url] });
    assert.deepEqual(listing.imageUrls, [url]);
  } finally {
    await rm(`${UPLOAD_DIR}${url.split("/").pop()}`, { force: true });
  }
});

test("the database itself refuses more than 6 photos", async () => {
  const seller = await api.createUser();
  const { id } = await api.createListing(seller);
  await assert.rejects(
    api.sql("UPDATE listings SET image_urls = $1 WHERE id = $2", [ownPhotos(7), id]),
    { code: "23514" }, // check_violation: listings_image_urls_check
  );
});
