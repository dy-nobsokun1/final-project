// Builds sample-listings.json: items written to look like real AUPP students posted them, so the
// marketplace has something realistic to show. Needs internet (for the textbooks); run it only to
// rebuild the file:  node scripts/fetch-sample-listings.js     Then load them: npm run db:samples
//
//   - Items: hand-written below. Their photos are everyday snapshots from Wikimedia Commons
//     (https://commons.wikimedia.org) and Flickr (found through https://openverse.org), all under
//     CC0, CC BY or CC BY-SA. Each photo keeps its page, author and licence in `credits`.
//   - Textbooks: real books from Open Library (https://openlibrary.org) with their cover photos.
//
// Photos stay on those sites (we store their URLs), so no third-party images enter this repo.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

/**
 * A Wikimedia Commons photo: the 960px-wide copy Commons serves (a standard size, so it always
 * exists) and the credit. Commons keeps each file in folders named after the MD5 hash of its name.
 */
function commons(file, author, licence) {
  const name = encodeURIComponent(file);
  const hash = createHash("md5").update(file).digest("hex");
  return {
    url: `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${name}/960px-${name}`,
    page: `https://commons.wikimedia.org/wiki/File:${name}`,
    author,
    licence,
  };
}

/** A Flickr photo: its large size and the credit. */
function flickr(url, page, author, licence) {
  return { url, page, author, licence };
}

// [title, category, condition, type, price, seller (index into `sellers`), posted how many hours ago,
//  description, photos (the first is the cover), auction ({ days, minIncrement }, auctions only)].
// For a wanted post (buy_request) the price is the budget; for an auction it is the starting bid.
// The newest posts are PC parts with clear photos, because the home page hero shows the newest three.
const ITEMS = [
  ["Corsair Vengeance LPX 16GB (2x8GB) DDR4 desktop RAM", "electronics", "like_new", "sale", 55, 1, 2,
    "Two 8GB sticks from my desktop, I moved to a 32GB kit. Both pass MemTest and have no scratches. Can meet at AUPP.",
    [commons("2*8Go_DDR4_Corsair_-_2018-05-08.jpg", "Bretwa", "CC BY-SA 4.0")]],
  ["Gigabyte RTX 3090 Eagle OC 24GB graphics card", "electronics", "good", "auction", 450, 3, 5,
    "My GPU for two years of gaming and some Blender, never mined. Runs cool, I'm going back to a laptop. Highest bid wins, pick up at AUPP.",
    [commons("Gigabyte_GeForce_RTX_3090_Eagle_OC_24G,_24576_MiB_GDDR6X_Front_20201114_DSC5880.jpg", "PantheraLeo1359531", "CC BY 4.0"),
      commons("Gigabyte_GeForce_RTX_3090_Eagle_OC_24G,_24576_MiB_GDDR6X_Anschlüsse_20201114.jpg", "PantheraLeo1359531", "CC BY 4.0")],
    { days: 4, minIncrement: 10 }],
  ["AMD Ryzen 7 1800X", "electronics", "good", "sale", 55, 1, 9,
    "8 cores, still fast for coding and video editing. I upgraded my board, so it's spare: CPU only, the photo is from before I took it out. Can meet at AUPP.",
    [commons("AMD_Ryzen_7_1800X.jpg", "Brian Wong", "CC BY-SA 2.0")]],
  ["Looking for 16GB DDR4 laptop RAM", "electronics", "good", "buy_request", 40, 4, 12,
    "My laptop slows down with Revit and Chrome open. Need one 16GB DDR4 SO-DIMM stick, 3200 if possible. Can meet at AUPP.",
    []],
  ["Kingston 32GB (2x16GB) DDR4 laptop RAM", "electronics", "like_new", "sale", 85, 5, 15,
    "Two 16GB SO-DIMM sticks (DDR4-2400). Bought them for my old laptop, then got a new one with RAM built in. Can meet at AUPP.",
    [commons("KVR24S17D8-16_x2_20170724.jpg", "Kenming Wang", "CC BY-SA 2.0")]],
  ["Crucial 4GB DDR4 laptop RAM (SO-DIMM)", "electronics", "good", "sale", 12, 2, 20,
    "The stick my laptop came with, I swapped it for a bigger one. Works fine, good as a spare. Can meet at AUPP.",
    [commons("Crucial_CT4G4SFS8213_on_laptop_motherboard_20171218.jpg", "Diego Torres Silvestre", "CC BY 2.0")]],
  ["Looking for a used graphics card (GTX 1660 or better)", "electronics", "good", "buy_request", 120, 5, 26,
    "Building my first PC on a student budget. Anything from a GTX 1660 up, as long as it works. Message me.",
    []],
  ["Gigabyte GTX 1660 Ti 6GB graphics card", "electronics", "good", "sale", 95, 0, 31,
    "A GPU that runs most games at 1080p on medium to high. No crashes and the fans are quiet, selling because I upgraded. Can meet at AUPP.",
    [commons("Gigabyte_GTX_1660_Ti_graphics_card_(51993493927).jpg", "Chi Ho Chan", "CC BY 2.0")]],
  ["Teal city bike", "bikes", "good", "auction", 40, 4, 36,
    "Easy to ride to class, the brakes and chain were serviced last month. Graduating soon, so highest bid wins. Pick up at AUPP.",
    [commons("Bicycle_parked_at_a_no_bicycle_parking_sign,_Rotterdam-Centrum,_Rotterdam_(2020)_01.jpg", "Donald Trung Quoc Don", "CC BY-SA 4.0"),
      commons("Bicycle_parked_at_a_no_bicycle_parking_sign,_Rotterdam-Centrum,_Rotterdam_(2020)_02.jpg", "Donald Trung Quoc Don", "CC BY-SA 4.0")],
    { days: 5, minIncrement: 2 }],
  ["Samsung 960 EVO 500GB NVMe SSD", "electronics", "good", "sale", 30, 1, 42,
    "M.2 NVMe drive, about 90% health in CrystalDiskInfo. Wiped and ready to use. Can meet at AUPP.",
    [commons("Samsung_960_EVO_NVME_M.2_SSD_by_Daniel_Aleksandersen.jpg", "Daniel Aleksandersen", "CC BY-SA 2.0")]],
  ["Metal desk lamp (free)", "furniture", "fair", "giveaway", 0, 2, 47,
    "Old desk lamp with an arm you can bend. Works, bulb included. Free, just pick it up at AUPP.",
    [flickr("https://live.staticflickr.com/5088/5249956913_4ae598757a_b.jpg", "https://www.flickr.com/photos/36910487@N07/5249956913",
      "TheLivingRoominKenmore", "CC BY 2.0")]],
  ["Samsung 870 QVO 1TB SATA SSD", "electronics", "like_new", "sale", 45, 2, 55,
    "2.5-inch SSD, used a few months as extra storage. Good for bringing an old laptop back to life. Can meet at AUPP.",
    [commons("SAMSUNG_SATA_SSD_870_QVO_1TB_FRONT.jpg", "Dinkun Chen", "CC BY-SA 4.0"),
      commons("SAMSUNG_SATA_SSD_870_QVO_1TB_REAR.jpg", "Dinkun Chen", "CC BY-SA 4.0")]],
  ["Looking for a mini fridge for my dorm", "furniture", "good", "buy_request", 45, 3, 60,
    "A small one is fine, just for drinks and fruit. It has to work and not be too loud. I can pick it up near AUPP.",
    []],
  ["OCZ 600W power supply", "electronics", "fair", "sale", 25, 3, 70,
    "Old but reliable, it ran my PC for four years without a problem. All cables included. Can meet at AUPP.",
    [commons("OCZ_600W_power_supply_unit.JPG", "Danrok", "CC BY-SA 3.0")]],
  ["Sihoo M57 mesh office chair", "furniture", "like_new", "sale", 45, 0, 80,
    "Mesh back with a headrest, the height and armrests adjust. Bought it last semester, but I'm moving out. Pick up near AUPP.",
    [commons("Sihoo_M57_mesh_office_chair_03.jpg", "Waldyrious", "CC BY-SA 4.0"),
      commons("Sihoo_M57_mesh_office_chair_06.jpg", "Waldyrious", "CC BY-SA 4.0")]],
  ["Arctic Freezer 13 CPU cooler", "electronics", "good", "sale", 10, 1, 92,
    "Tower cooler, much quieter than a stock one. The photo is from my old build, it comes with its fan and clips. Can meet at AUPP.",
    [commons("Arctic_Freezer_13_heatsink.jpg", "Blackcat", "CC BY-SA 4.0")]],
  ["Computer desk with drawer and cupboard", "furniture", "good", "sale", 35, 4, 105,
    "Wooden desk with a keyboard tray, a drawer and a cupboard. Monitor and PC not included. Pick up near AUPP, I can help carry it.",
    [commons("Computer_desk.jpg", "Dhivyabsk", "CC BY-SA 4.0")]],
  ["RGB mechanical keyboard (TKL) - trade for a mouse or headset", "electronics", "good", "trade", 0, 0, 115,
    "Clicky switches and rainbow lighting, but too loud for my dorm. I'd trade it for a wireless mouse or a headset. Can meet at AUPP.",
    [commons("Lingbao_JIGUANSHI_Mechanical_Gaming_Keyboard.jpg", "Morn", "CC BY-SA 4.0")]],
  ["Small rice cooker", "other", "good", "sale", 10, 5, 125,
    "Enough rice for two or three people. The inner pot has no scratches. Can meet at AUPP.",
    [commons("Rival_Rice_Cooker.jpg", "Jugo Yokomizo", "CC BY-SA 4.0")]],
  ["Wired gaming mouse with RGB", "electronics", "good", "sale", 8, 4, 135,
    "Green lighting, works fine. I switched to a wireless one. Can meet at AUPP.",
    [commons("Old_Computer_Mouse.jpg", "Dean M. Campos", "CC BY-SA 4.0")]],
  ["Lenovo ThinkPad T460 (i5, 8GB, 256GB SSD)", "electronics", "good", "sale", 160, 1, 150,
    "Battery lasts about 4 hours and the keyboard is great for typing essays. Fresh Windows install. Can meet at AUPP.",
    [commons("T460_angled.jpg", "Albert György", "CC BY 4.0")]],
  ["iPad Pro 12.9 (2020) with Magic Keyboard", "electronics", "like_new", "sale", 550, 4, 170,
    "128GB, Wi-Fi. I used it for drawing plans and it always stayed in the keyboard case, so no scratches. Pencil not included. Can meet at AUPP.",
    [commons("13_inch_iPad_Pro_2020_on_a_desk.jpg", "Glide08", "CC BY-SA 4.0")]],
  ["Electric kettle (free)", "other", "good", "giveaway", 0, 0, 190,
    "I got a new one, so this one is free. Boils fast and doesn't leak. Pick it up at AUPP.",
    [commons("Electric_kettle,_Ribnitz-Damgarten_(LRM_20200521_132413-hdr).jpg", "Matti Blume", "CC BY-SA 4.0"),
      commons("Electric_kettle_(LRM_20200521_132339-hdr).jpg", "Matti Blume", "CC BY-SA 4.0")]],
  ["AirPods 4", "electronics", "like_new", "sale", 85, 5, 210,
    "Got them as a gift, but I already had a pair. Used a few times, case and cable included. Can meet at AUPP.",
    [commons("Airpods_4.jpg", "AppleFans 1", "CC0")]],
  ["Badminton racket with shuttlecock", "other", "good", "sale", 15, 2, 230,
    "Light racket, the strings are still tight. Can meet at AUPP, or at the court if you want to try it.",
    [commons("Rachetă_de_badminton_şi_fluturaş.jpg", "Vladimir Maftei", "CC BY-SA 4.0")]],
  ["Casio fx-991ES calculator", "electronics", "good", "sale", 12, 2, 250,
    "Allowed in most math and stats exams. Works perfectly and comes with its cover. Can meet at AUPP.",
    [commons("Casio_fx-991ES_Calculator.jpg", "Stefan-Xp", "CC BY-SA 3.0")]],
  ["Acoustic guitar with bag - trade for a keyboard or ukulele", "other", "good", "trade", 0, 3, 270,
    "Full-size guitar with a soft bag, good for learning. I'd trade for a digital piano or a ukulele, and add up to $20 cash if yours is worth more. Can meet at AUPP.",
    [commons("Acoustic_Guitar_2.jpg", "Johnnydeezwax", "CC BY-SA 3.0")]],
  ["Backpack with lots of pockets", "other", "good", "sale", 12, 5, 300,
    "Padded straps and room for a laptop and books. All the zips work. Can meet at AUPP.",
    [flickr("https://live.staticflickr.com/2628/3770457870_325823e331_b.jpg", "https://www.flickr.com/photos/14771153@N04/3770457870",
      "slgckgc", "CC BY 2.0")]],
  ["Denim jacket (size M)", "clothing", "good", "sale", 12, 0, 335,
    "Light blue, washed and ready to wear. It's too small for me now. Can meet at AUPP.",
    [commons("Jean_jacket.jpg", "NikosLikomitros", "CC0")]],
  ["Standing fan", "other", "fair", "sale", 10, 3, 365,
    "Three speeds and it still turns side to side. A bit noisy on the top speed. Pick up at AUPP.",
    [commons("Floor_fan.jpg", "Hans Olav Lien", "CC BY-SA 3.0")]],
  ["North Star sneakers (size 42)", "clothing", "like_new", "sale", 20, 3, 400,
    "White with blue stripes, worn twice. Wrong size for me, comes with the box. Can meet at AUPP.",
    [commons("North_Star_sneakers_(1).jpg", "Sherwin", "CC BY-SA 4.0"),
      commons("North_Star_sneakers_(2).jpg", "Sherwin", "CC BY-SA 4.0")]],
  ["Pink motorbike helmet (size M)", "bikes", "good", "sale", 10, 5, 440,
    "No cracks in the visor. I got a new one for my birthday. Can meet at AUPP.",
    [commons("Motorcycle_helmet.jpg", "MediaPhoto.Org", "CC BY 3.0")]],
];

// Cheap items ($1 to $5), so KHQR and card payments can be tried without spending much. Posted a day
// or two ago, so the hero keeps showing the newer PC parts. Added after the textbooks (see below), so
// the textbooks' sellers and times, which count the listings before them, stay as they were.
const CHEAP_ITEMS = [
  ["BIC 4-colour pen", "other", "like_new", "sale", 1, 0, 27,
    "Blue, black, red and green in one pen, all four still write. I bought a pack and only need one. Can meet at AUPP.",
    [commons("Bic_4_couleurs.jpg", "Prog138", "CC BY-SA 4.0")]],
  ["College-ruled composition notebook (unused)", "other", "new", "sale", 2, 1, 33,
    "100 sheets, never written in. I bought two at the start of term. Can meet at AUPP.",
    [commons("Green_Soft-Covered_Composition_Notebook_(14822730560).jpg", "slgckgc", "CC BY 2.0")]],
  ["USB-A to USB-C cable (1 m)", "electronics", "good", "sale", 3, 2, 39,
    "Charges and transfers data. A spare from a phone box, I charge wirelessly now. Can meet at AUPP.",
    [commons("USB-C_cable_2017_A.jpg", "Fructibus", "CC0")]],
  ["PNY 16GB USB flash drive", "electronics", "good", "sale", 4, 3, 45,
    "Wiped and empty. Handy for printing at the library. Can meet at AUPP.",
    [commons("PNY_USB_flash_drive_(16GB),_Hillegersberg,_Rotterdam_(2020)_01.jpg", "Donald Trung Quoc Don", "CC BY-SA 4.0")]],
  ["Wired earphones (3.5 mm jack)", "electronics", "good", "sale", 5, 4, 50,
    "Both sides work and the sound is clear. Cleaned, with spare ear pads. Can meet at AUPP.",
    [commons("Earphones_BW_2011-12-10_15-49-08.JPG", "Berthold Werner", "CC BY-SA 3.0")]],
];

// Course subjects for textbooks (Open Library), each with its price. The last three become "wanted"
// posts, where the price is the budget.
const SUBJECTS = [["calculus", 18], ["physics", 25], ["organic chemistry", 12], ["biology", 30],
  ["microeconomics", 15], ["accounting", 22], ["marketing", 10], ["statistics", 28],
  ["computer programming", 20], ["psychology", 16], ["linear algebra", 24], ["english grammar", 14],
  ["data structures", 20], ["macroeconomics", 15], ["anatomy", 25]];
// Chosen because their top Open Library book is an English textbook (sociology, philosophy and
// architecture gave German, French or Swedish editions).
const MORE_SUBJECTS = [["general chemistry", 20], ["human resource management", 18], ["databases", 22],
  ["thermodynamics", 28], ["world history", 16], ["art history", 24], ["finance", 12],
  ["discrete mathematics", 20]]; // the last one is wanted

const CONDITIONS = ["good", "like_new", "fair", "good"]; // textbooks are never "new" here
const NOTES = {
  like_new: "Barely opened, no highlighting.",
  good: "Some highlighting in the first chapters, otherwise clean.",
  fair: "The cover is worn and some pages have pencil notes, but nothing is missing.",
};

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

const toListing = ([title, category, condition, type, price, seller, hoursAgo, description, photos, auction]) => ({
  title,
  description,
  category,
  condition,
  type,
  price,
  images: photos.map((photo) => photo.url),
  credits: photos.map(({ page, author, licence }) => ({ page, author, licence })),
  ...(auction ? { auction } : {}),
  seller,
  hoursAgo,
});
const listings = ITEMS.map(toListing);

/** Adds one Open Library book per [subject, price]; the last `wanted` subjects become wanted posts. */
async function addTextbooks(subjects, wanted) {
  for (const [index, [subject, price]] of subjects.entries()) {
    const { docs } = await getJson(`https://openlibrary.org/search.json?subject=${encodeURIComponent(subject)}`
      + "&limit=10&fields=key,title,author_name,cover_i,first_publish_year");
    const book = docs.find((doc) => doc.cover_i && doc.author_name && doc.title.length <= 80
      && !listings.some((listing) => listing.title.endsWith(doc.title))); // no book twice
    if (!book) continue;
    const isWanted = index >= subjects.length - wanted;
    const condition = CONDITIONS[index % CONDITIONS.length];
    const count = listings.length;
    listings.push({
      title: isWanted ? `Looking for: ${book.title}` : book.title,
      description: isWanted
        ? `Need "${book.title}" by ${book.author_name[0]} for class. Any edition is fine, message me.`
        : `${book.title} by ${book.author_name[0]} (${book.first_publish_year ?? "n.d."}). ${NOTES[condition]} Can meet at AUPP.`,
      category: "textbooks",
      condition,
      type: isWanted ? "buy_request" : "sale",
      price, // for a wanted post, this is the budget
      images: [`https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`],
      credits: [{ page: `https://openlibrary.org${book.key}`, author: "Open Library", licence: "Open Library Covers API" }],
      // Spread over 6 sellers and the last 3 weeks, but never among the newest few posts.
      seller: count % 6,
      hoursAgo: 18 + ((count * 37) % 470),
    });
  }
}

await addTextbooks(SUBJECTS, 3);
await addTextbooks(MORE_SUBJECTS, 1);
listings.push(...CHEAP_ITEMS.map(toListing));

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
