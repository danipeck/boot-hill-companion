import type { CatalogueItem } from './equipment';

// One-time services retired from older saved catalogues; IDs stay stable.
export const retiredCatalogueEntries: Record<string, string> = {
  "item-42": "Cheap Meal",
  "item-43": "Shave & Haircut",
  "item-47": "Bath",
  "item-51": "Bath, Freshwater",
  "item-63": "Whiskey (shot)",
  "item-66": "Beer",
  "item-70": "Sleazy hotel",
  "item-73": "Medical consultation",
  "item-74": "Average hotel",
  "item-77": "Bullet removed",
  "item-78": "Deluxe hotel",
  "item-81": "Bullet hole patched",
  "item-82": "Corral space for horse",
  "item-85": "Broken bone set",
  "item-86": "Rooming House",
  "item-88": "Broken bone splinted",
  "item-89": "Cowboy",
  "item-91": "Buckshot removed",
  "item-92": "Cowboy, Foreman",
  "item-94": "Concussion treated",
  "item-95": "Prison Guard",
  "item-97": "Lacerations stitched",
  "item-98": "Coroner",
  "item-100": "Powder burns treated",
  "item-101": "Lawman",
  "item-103": "Other burns treated",
  "item-104": "Arrest Bonus",
  "item-106": "Leeching",
  "item-107": "Deputy",
  "item-108": "Amputation",
  "item-109": "Arrest Bonus",
  "item-110": "Diseases treated",
  "item-111": "Fines",
  "item-112": "Court Costs",
  "item-113": "Marriages",
  "item-114": "Bartender",
  "item-115": "Waitress/Saloon Girl",
  "item-116": "Hired Gunfighter",
  "item-117": "Teamster",
  "item-118": "Civilian Scout",
  "item-119": "Undertaker",
  "item-120": "Midwife"
};

// Campaign possessions and supplies supplied by the user.
export const startingCatalogue: CatalogueItem[] = [
  {
    "id": "item-1",
    "name": "Hunting Knife",
    "category": "Weapons",
    "priceCents": 100,
    "unit": "each",
    "notes": "Throwing",
    "kind": "item",
    "code": "KN",
    "availability": "",
    "weapon": {
      "ranges": [
        "1",
        "2",
        "3",
        "4"
      ],
      "ammo": "-",
      "reload": "-",
      "speed": "Average"
    }
  },
  {
    "id": "item-2",
    "name": "Tomahawk",
    "category": "Weapons",
    "priceCents": null,
    "unit": "each",
    "notes": "Throwing, Chance of stun",
    "kind": "item",
    "code": "TH",
    "availability": "Shadowdancer",
    "weapon": {
      "ranges": [
        "1",
        "4",
        "8",
        "4"
      ],
      "ammo": "-",
      "reload": "-",
      "speed": "Average"
    }
  },
  {
    "id": "item-3",
    "name": "Bow & Arrow",
    "category": "Weapons",
    "priceCents": null,
    "unit": "each",
    "notes": "Throwing, shoots over obstruction",
    "kind": "item",
    "code": "BW",
    "availability": "Shadowdancer",
    "weapon": {
      "ranges": [
        "7",
        "18",
        "30",
        "50"
      ],
      "ammo": "1",
      "reload": "1",
      "speed": "Below Average"
    }
  },
  {
    "id": "item-4",
    "name": "Spear",
    "category": "Weapons",
    "priceCents": null,
    "unit": "each",
    "notes": "Throwing",
    "kind": "item",
    "code": "SP",
    "availability": "Shadowdancer",
    "weapon": {
      "ranges": [
        "2",
        "5",
        "10",
        "15"
      ],
      "ammo": "-",
      "reload": "-",
      "speed": "Below Average"
    }
  },
  {
    "id": "item-5",
    "name": "Single-shot Derringer",
    "category": "Weapons",
    "priceCents": 500,
    "unit": "each",
    "notes": "Concealable",
    "kind": "item",
    "code": "1D",
    "availability": "",
    "weapon": {
      "ranges": [
        "1",
        "3",
        "6",
        "10"
      ],
      "ammo": "1",
      "reload": "2",
      "speed": "Average"
    }
  },
  {
    "id": "item-6",
    "name": "Cap & Ball Revolver",
    "category": "Weapons",
    "priceCents": 2000,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "CBR",
    "availability": "",
    "weapon": {
      "ranges": [
        "3",
        "7",
        "12",
        "26"
      ],
      "ammo": "6",
      "reload": "1",
      "speed": "Below Average"
    }
  },
  {
    "id": "item-7",
    "name": "Long-barrel Revolver",
    "category": "Weapons",
    "priceCents": 3500,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "LBR",
    "availability": "Witchhunter",
    "weapon": {
      "ranges": [
        "6",
        "12",
        "25",
        "45"
      ],
      "ammo": "6",
      "reload": "3",
      "speed": "Below Average"
    }
  },
  {
    "id": "item-8",
    "name": "Fast-draw Revolver",
    "category": "Weapons",
    "priceCents": 4000,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "FDR6",
    "availability": "Federal Marshal",
    "weapon": {
      "ranges": [
        "3",
        "7",
        "15",
        "30"
      ],
      "ammo": "6",
      "reload": "3",
      "speed": "Very Fast"
    }
  },
  {
    "id": "item-9",
    "name": "Single-action Revolver",
    "category": "Weapons",
    "priceCents": 3000,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "SAR6",
    "availability": "",
    "weapon": {
      "ranges": [
        "4",
        "10",
        "20",
        "40"
      ],
      "ammo": "6",
      "reload": "3",
      "speed": "Fast"
    }
  },
  {
    "id": "item-10",
    "name": "Double-action Revolver",
    "category": "Weapons",
    "priceCents": 2800,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "DAR6",
    "availability": "",
    "weapon": {
      "ranges": [
        "4",
        "10",
        "20",
        "40"
      ],
      "ammo": "6",
      "reload": "3",
      "speed": "Average"
    }
  },
  {
    "id": "item-11",
    "name": "Single-barrel Shotgun",
    "category": "Weapons",
    "priceCents": 2000,
    "unit": "each",
    "notes": "Multiple projectiles",
    "kind": "item",
    "code": "1SG",
    "availability": "",
    "weapon": {
      "ranges": [
        "6",
        "12",
        "18",
        "36"
      ],
      "ammo": "1",
      "reload": "2",
      "speed": "Slow"
    }
  },
  {
    "id": "item-12",
    "name": "Double-barrel Shotgun",
    "category": "Weapons",
    "priceCents": 3000,
    "unit": "each",
    "notes": "Multiple projectiles",
    "kind": "item",
    "code": "2SG",
    "availability": "",
    "weapon": {
      "ranges": [
        "6",
        "12",
        "18",
        "36"
      ],
      "ammo": "2",
      "reload": "2",
      "speed": "Slow"
    }
  },
  {
    "id": "item-13",
    "name": "Double-barrel Scattergun",
    "category": "Weapons",
    "priceCents": 4000,
    "unit": "each",
    "notes": "Multiple projectiles",
    "kind": "item",
    "code": "SCG",
    "availability": "",
    "weapon": {
      "ranges": [
        "2",
        "4",
        "8",
        "15"
      ],
      "ammo": "2",
      "reload": "2",
      "speed": "Below Average"
    }
  },
  {
    "id": "item-14",
    "name": "Repeating Rifle",
    "category": "Weapons",
    "priceCents": 2500,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "CWR",
    "availability": "",
    "weapon": {
      "ranges": [
        "15",
        "30",
        "60",
        "120"
      ],
      "ammo": "7",
      "reload": "2",
      "speed": "Slow"
    }
  },
  {
    "id": "item-15",
    "name": "Buffalo Rifle",
    "category": "Weapons",
    "priceCents": 3000,
    "unit": "each",
    "notes": "Chance of stun",
    "kind": "item",
    "code": "BR",
    "availability": "",
    "weapon": {
      "ranges": [
        "30",
        "60",
        "120",
        "300"
      ],
      "ammo": "1",
      "reload": "1",
      "speed": "Very Slow"
    }
  },
  {
    "id": "item-16",
    "name": "Muzzle-loading Rifle",
    "category": "Weapons",
    "priceCents": 1700,
    "unit": "each",
    "notes": "",
    "kind": "item",
    "code": "MLR",
    "availability": "",
    "weapon": {
      "ranges": [
        "20",
        "40",
        "80",
        "200"
      ],
      "ammo": "1",
      "reload": "1/3",
      "speed": "Very Slow"
    }
  },
  {
    "id": "item-17",
    "name": "Holster & Gun Belt",
    "category": "Equipment",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-18",
    "name": "Saddle, Bridle, Pads",
    "category": "Transportation",
    "priceCents": 4000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-19",
    "name": "Hat",
    "category": "Men's clothing",
    "priceCents": 200,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-20",
    "name": "Coffee",
    "category": "Food & drink",
    "priceCents": 30,
    "unit": "lb",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-21",
    "name": "Rifle Sheath",
    "category": "Equipment",
    "priceCents": 400,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-22",
    "name": "Saddlebags",
    "category": "Transportation",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-23",
    "name": "Hat, Good",
    "category": "Men's clothing",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-24",
    "name": "Bacon",
    "category": "Food & drink",
    "priceCents": 20,
    "unit": "lb",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-25",
    "name": "Poor Horse",
    "category": "Transportation",
    "priceCents": 2000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-26",
    "name": "Shirt",
    "category": "Men's clothing",
    "priceCents": 100,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-27",
    "name": "Beef",
    "category": "Food & drink",
    "priceCents": 7,
    "unit": "lb",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-28",
    "name": "Ammunition",
    "category": "Equipment",
    "priceCents": 200,
    "unit": "(100)",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-29",
    "name": "Fair Horse",
    "category": "Transportation",
    "priceCents": 5000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-30",
    "name": "Vest",
    "category": "Men's clothing",
    "priceCents": 100,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-31",
    "name": "Dried Beef (Jerky)",
    "category": "Food & drink",
    "priceCents": 20,
    "unit": "lb",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-32",
    "name": "Shotgun Loads",
    "category": "Equipment",
    "priceCents": 200,
    "unit": "(25)",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-33",
    "name": "Good Horse",
    "category": "Transportation",
    "priceCents": 10000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-34",
    "name": "Trousers",
    "category": "Men's clothing",
    "priceCents": 200,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-35",
    "name": "Flour",
    "category": "Food & drink",
    "priceCents": 4,
    "unit": "lb",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-36",
    "name": "Black Powder",
    "category": "Equipment",
    "priceCents": 500,
    "unit": "(12.5lb bag)",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-37",
    "name": "Excellent Horse",
    "category": "Transportation",
    "priceCents": 15000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-38",
    "name": "Shoes, Plow",
    "category": "Men's clothing",
    "priceCents": 125,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-39",
    "name": "Root Beer",
    "category": "Food & drink",
    "priceCents": 10,
    "unit": "bottle",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-40",
    "name": "Mule",
    "category": "Transportation",
    "priceCents": 2000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-41",
    "name": "Suit, Plain",
    "category": "Men's clothing",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-44",
    "name": "Oxen",
    "category": "Transportation",
    "priceCents": 2500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-45",
    "name": "Suit, Fancy",
    "category": "Men's clothing",
    "priceCents": 1000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-46",
    "name": "Mess Kit",
    "category": "Food & drink",
    "priceCents": 200,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-48",
    "name": "Cattle, Calf",
    "category": "Transportation",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-49",
    "name": "Boots",
    "category": "Men's clothing",
    "priceCents": 1000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-50",
    "name": "Canteen",
    "category": "Food & drink",
    "priceCents": 100,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-52",
    "name": "Cattle, Yearling",
    "category": "Transportation",
    "priceCents": 1000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-53",
    "name": "Chaps",
    "category": "Men's clothing",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-54",
    "name": "Survival Rations",
    "category": "Food & drink",
    "priceCents": 150,
    "unit": "day",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-55",
    "name": "Field Glasses",
    "category": "Miscellaneous",
    "priceCents": 1000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-56",
    "name": "Cattle, at railhead",
    "category": "Transportation",
    "priceCents": 3000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-57",
    "name": "Spurs",
    "category": "Men's clothing",
    "priceCents": 700,
    "unit": "(pair)",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-58",
    "name": "Tobacco",
    "category": "Food & drink",
    "priceCents": 10,
    "unit": "bag",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-59",
    "name": "Telescope",
    "category": "Miscellaneous",
    "priceCents": 600,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-60",
    "name": "Buggy",
    "category": "Transportation",
    "priceCents": 4000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-61",
    "name": "Gloves",
    "category": "Men's clothing",
    "priceCents": 200,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-62",
    "name": "Whiskey",
    "category": "Food & drink",
    "priceCents": 200,
    "unit": "bottle",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-64",
    "name": "Steel Safe, Small",
    "category": "Miscellaneous",
    "priceCents": 5000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-65",
    "name": "Buckboard Wagon",
    "category": "Transportation",
    "priceCents": 3500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-67",
    "name": "Stereoscope",
    "category": "Miscellaneous",
    "priceCents": 75,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-68",
    "name": "Shoes",
    "category": "Women's Clothing",
    "priceCents": 400,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-69",
    "name": "Tombstone",
    "category": "Miscellaneous",
    "priceCents": 1000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-71",
    "name": "Hat",
    "category": "Women's Clothing",
    "priceCents": 300,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-72",
    "name": "Accordion",
    "category": "Entertainment",
    "priceCents": 500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-75",
    "name": "Shirt",
    "category": "Women's Clothing",
    "priceCents": 150,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-76",
    "name": "Banjo",
    "category": "Entertainment",
    "priceCents": 900,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-79",
    "name": "Skirt",
    "category": "Women's Clothing",
    "priceCents": 300,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-80",
    "name": "Bible",
    "category": "Entertainment",
    "priceCents": 9000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-83",
    "name": "Wrap",
    "category": "Women's Clothing",
    "priceCents": 1500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-84",
    "name": "Concertina",
    "category": "Entertainment",
    "priceCents": 300,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-87",
    "name": "Fiddle",
    "category": "Entertainment",
    "priceCents": 600,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-90",
    "name": "Gramophone",
    "category": "Entertainment",
    "priceCents": 2500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-93",
    "name": "Gramophone Record",
    "category": "Entertainment",
    "priceCents": 5000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-96",
    "name": "Guitar",
    "category": "Entertainment",
    "priceCents": 700,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-99",
    "name": "Hardcover Book",
    "category": "Entertainment",
    "priceCents": 7500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-102",
    "name": "Harmonica",
    "category": "Entertainment",
    "priceCents": 2500,
    "unit": "each",
    "notes": "",
    "kind": "item"
  },
  {
    "id": "item-105",
    "name": "Piano, Upright",
    "category": "Entertainment",
    "priceCents": 10000,
    "unit": "each",
    "notes": "",
    "kind": "item"
  }
];
