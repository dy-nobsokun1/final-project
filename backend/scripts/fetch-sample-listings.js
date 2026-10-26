// Builds sample-listings.json from two free public datasets, so the marketplace has realistic items
// to show. Needs internet; run it only to rebuild the file:  node scripts/fetch-sample-listings.js
// Then load the items with: npm run db:samples
//
//   - DummyJSON (https://dummyjson.com): a fake product API made for prototypes. Products, photos.
//   - Open Library (https://openlibrary.org): real books (public-domain data) with cover photos.
//
// Photos stay on those sites (we store their URLs), so no third-party images enter this repo.
import { writeFile } from "node:fs/promises";

// DummyJSON category -> [our category, which products]: a number takes that many, cheapest first
// (so no luxury items); a list names the products, where cheapest first would pick forks and spoons.
const PRODUCT_CATEGORIES = {
  laptops: ["electronics", 4],
  smartphones: ["electronics", 5],
  tablets: ["electronics", 3],
  "mobile-accessories": ["electronics", 4],
  furniture: ["furniture", ["Bedside Table African Cherry", "Knoll Saarinen Executive Conference Chair"]],
  "home-decoration": ["furniture", ["Table Lamp", "Plant Pot"]],
  "mens-shirts": ["clothing", 3],
  tops: ["clothing", 2],
  "womens-dresses": ["clothing", 2],
  "mens-shoes": ["clothing", 2],
  "womens-shoes": ["clothing", 2],
  "womens-bags": ["clothing", 2],
  motorcycle: ["bikes", 2],
  "sports-accessories": ["other", ["Tennis Racket", "Basketball", "Football", "Cricket Bat", "Feather Shuttlecock"]],
  "kitchen-accessories": ["other", ["Microwave Oven", "Electric Stove", "Boxed Blender", "Lunch Box", "Carbon Steel Wok"]],
};

// Course subjects for textbooks (Open Library), each with its price. The last three become "wanted"
// posts, where the price is the budget.
const SUBJECTS = [["calculus", 18], ["physics", 25], ["organic chemistry", 12], ["biology", 30],
  ["microeconomics", 15], ["accounting", 22], ["marketing", 10], ["statistics", 28],
  ["computer programming", 20], ["psychology", 16], ["linear algebra", 24], ["english grammar", 14],
  ["data structures", 20], ["macroeconomics", 15], ["anatomy", 25]];

// A second batch, added later. It comes after the first 60 items, so those keep their seller, date
// and condition, and `npm run db:samples` adds only the new ones.
const MORE_PRODUCTS = {
  laptops: ["electronics", ["Apple MacBook Pro 14 Inch Space Grey"]],
  smartphones: ["electronics", ["Samsung Galaxy S8", "iPhone X"]],
  "mobile-accessories": ["electronics", ["Apple Airpods", "Beats Flex Wireless Earphones", "Apple MagSafe Battery Pack"]],
  "mens-watches": ["clothing", ["Brown Leather Belt Watch"]],
  "womens-watches": ["clothing", ["Women's Wrist Watch"]],
  sunglasses: ["clothing", ["Classic Sun Glasses"]],
  "sports-accessories": ["other", ["Baseball Glove"]],
  "kitchen-accessories": ["other", ["Pan", "Hand Blender", "Chopping Board"]],
};
// Chosen because their top Open Library book is an English textbook (sociology, philosophy and
// architecture gave German, French or Swedish editions).
const MORE_SUBJECTS = [["general chemistry", 20], ["human resource management", 18], ["databases", 22],
  ["thermodynamics", 28], ["world history", 16], ["art history", 24], ["finance", 12],
  ["discrete mathematics", 20]]; // the last one is wanted

const CONDITIONS = ["good", "like_new", "fair", "good", "new"];
// What a used item sells for, as a share of its new price.
const RESALE = { new: 0.8, like_new: 0.7, good: 0.55, fair: 0.4 };
const NOTES = {
  new: "Still unopened.",
  like_new: "Used only a few times, works like new.",
  good: "Used, in good working condition.",
  fair: "Shows some signs of use, but works fine.",
};

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

const listings = [];

const { products } = await getJson("https://dummyjson.com/products?limit=0");

/** Adds DummyJSON products, chosen as in PRODUCT_CATEGORIES, priced second-hand. */
function addProducts(categories) {
  for (const [source, [category, choice]] of Object.entries(categories)) {
    const cheapest = products.filter((p) => p.category === source).sort((a, b) => a.price - b.price);
    const picked = Array.isArray(choice) ? cheapest.filter((p) => choice.includes(p.title)) : cheapest.slice(0, choice);
    for (const product of picked) {
      const condition = CONDITIONS[listings.length % CONDITIONS.length];
      const price = Math.max(1, Math.round(product.price * RESALE[condition]));
      // Items that would sell for under $8 are given away instead; every 9th item is up for trade.
      const type = price < 8 ? "giveaway" : listings.length % 9 === 4 ? "trade" : "sale";
      listings.push({
        title: product.title,
        description: `${product.description} ${NOTES[condition]}${type === "trade" ? " Open to trades: tell me what you have." : ""}`,
        category,
        condition,
        type,
        price: type === "giveaway" ? 0 : price,
        images: product.images.slice(0, 3),
      });
    }
  }
}

/** Adds one Open Library book per [subject, price]; the last `wanted` subjects become wanted posts. */
async function addTextbooks(subjects, wanted) {
  for (const [index, [subject, price]] of subjects.entries()) {
    const { docs } = await getJson(`https://openlibrary.org/search.json?subject=${encodeURIComponent(subject)}`
      + "&limit=10&fields=title,author_name,cover_i,first_publish_year");
    const book = docs.find((doc) => doc.cover_i && doc.author_name && doc.title.length <= 80
      && !listings.some((listing) => listing.title.endsWith(doc.title))); // no book twice
    if (!book) continue;
    const isWanted = index >= subjects.length - wanted;
    const condition = CONDITIONS[index % 4]; // textbooks are never "new" here
    listings.push({
      title: isWanted ? `Looking for: ${book.title}` : book.title,
      description: isWanted
        ? `Need "${book.title}" by ${book.author_name[0]} for class. Any edition is fine, message me.`
        : `${book.title} by ${book.author_name[0]} (${book.first_publish_year ?? "n.d."}). ${NOTES[condition]}`,
      category: "textbooks",
      condition,
      type: isWanted ? "buy_request" : "sale",
      price, // for a wanted post, this is the budget
      images: [`https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`],
    });
  }
}

addProducts(PRODUCT_CATEGORIES);
await addTextbooks(SUBJECTS, 3);

// Two auctions: the cheapest laptop and the first scooter, ending a few days after loading.
for (const [title, days, minIncrement] of [["Lenovo Yoga 920", 3, 5], ["Scooter Motorcycle", 5, 20]]) {
  const item = listings.find((listing) => listing.title === title);
  if (item) Object.assign(item, { type: "auction", auction: { days, minIncrement } });
}

addProducts(MORE_PRODUCTS);
await addTextbooks(MORE_SUBJECTS, 1);

// Spread the items over 6 demo sellers and over the last few weeks, like real posts.
for (const [index, listing] of listings.entries()) {
  listing.seller = index % 6;
  listing.hoursAgo = (index * 7) % 400;
}

const sellers = [
  ["Sreyneang Chea", "sreyneang@demo.edu.kh", "Marketing", 2027],
  ["Vannak Sok", "vannak@demo.edu.kh", "Computer Science", 2026],
  ["Bopha Kim", "bopha@demo.edu.kh", "Biology", 2028],
  ["Rithy Heng", "rithy@demo.edu.kh", "Economics", 2027],
  ["Sophea Mao", "sophea@demo.edu.kh", "Architecture", 2026],
  ["Pisey Lim", "pisey@demo.edu.kh", "Psychology", 2028],
].map(([name, email, major, graduationYear]) => ({ name, email, major, graduationYear }));

const file = new URL("./sample-listings.json", import.meta.url);
await writeFile(file, `${JSON.stringify({ sellers, listings }, null, 2)}\n`);
const count = (key, value) => listings.filter((listing) => listing[key] === value).length;
console.log(`Wrote ${listings.length} listings for ${sellers.length} sellers: `
  + `${count("type", "sale")} for sale, ${count("type", "giveaway")} giveaways, ${count("type", "trade")} trades, `
  + `${count("type", "buy_request")} wanted, ${count("type", "auction")} auctions.`);
