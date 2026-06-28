// Fitment dictionaries — the platform's library of installable "what this
// product fits" reference trees (docs/104 §5.4, a 🟣 starter-config brick).
//
// A dictionary is platform DATA, not a per-tenant row: the published set is the
// same for every tenant (like the builder catalog), and a tenant INSTALLS one as
// their own tenant-scoped copy (a domain + a node tree stamped with their
// tenant_id). Nothing is global — there is no platform-seeded Vehicle domain;
// "Vehicle" is one dictionary among many, installed only when a vehicle-parts
// merchant asks for it.
//
// Each dictionary declares an ordered list of DIMENSIONS (its shape) — `level`
// dimensions form the node tree in order, `range` dimensions are numeric axes
// applied per product application. There is no fixed depth: Apparel is one
// level (Size); Vehicle is three (Make → Model → Engine) plus a Year range.
//
// This file is data-as-code (line-limit exempt) and zod-free / DB-free on
// purpose: both `@sparx/commerce`'s install service AND `@sparx/db`'s seed
// import it. Putting it here (commerce-schemas, which neither depends on db nor
// is in db's runtime graph) keeps the seed from importing `@sparx/commerce` and
// creating a Turbo dependency cycle.
//
// `planFitmentDictionaryRows` is the single stamping codepath: it turns a
// dictionary + a tenant id into the exact domain + node rows to insert (with
// pre-generated ids, materialized path/pathNames, and a slug-path → id index for
// product-link resolution). The install service and the demo seed both call it,
// so the tree a merchant installs and the tree the seed stamps are identical.

import type { FitmentDimension } from './fitment';

// ─── Authoring shape ──────────────────────────────────────────────────

export interface FitmentDictionaryNode {
  name: string;
  slug: string;
  attributes?: Record<string, string | number>;
  /** Child nodes one level deeper (the next `level` dimension). */
  children?: FitmentDictionaryNode[];
}

/** One installable fitment dictionary — a domain spec (dimensions) + its tree. */
export interface FitmentDictionary {
  /** Stable, globally-unique slug (the install path param). */
  slug: string;
  name: string;
  description: string;
  /** Lucide icon name shown in the picker + on the installed domain. */
  iconKey: string;
  /** Free-text search tags the picker filters on. */
  tags: string[];
  /** Ordered axes — `level` dims define tree depth, `range` dims narrow per product. */
  dimensions: FitmentDimension[];
  /** Top-level nodes; `children` recurse one `level` dimension deeper. */
  tree: FitmentDictionaryNode[];
}

/** Identity passthrough that pins the entry shape at the author site (a typo in
 *  `dimensions` is a type error here, not at install time). */
export function fitmentDictionary(d: FitmentDictionary): FitmentDictionary {
  return d;
}

// ─── The library ──────────────────────────────────────────────────────
//
// Industry-varied on purpose: no single vertical dominates the picker, so the
// platform never reads as auto-parts (or apparel, or anything) software. Each
// dictionary is a realistic-but-compact tree — enough to be usable on install
// and to demonstrate its depth, not an exhaustive catalog.

const VEHICLE = fitmentDictionary({
  slug: 'vehicle',
  name: 'Vehicle',
  description: 'Automotive fitment — Make → Model → Engine, narrowable by model year.',
  iconKey: 'car',
  tags: ['automotive', 'parts', 'truck', 'car', 'diesel'],
  dimensions: [
    { key: 'make', label: 'Make', kind: 'level' },
    { key: 'model', label: 'Model', kind: 'level' },
    { key: 'engine', label: 'Engine', kind: 'level' },
    { key: 'year', label: 'Year', kind: 'range', unit: 'year' },
  ],
  tree: [
    {
      name: 'Ford',
      slug: 'ford',
      attributes: { countryOfOrigin: 'US' },
      children: [
        {
          name: 'F-250 Super Duty',
          slug: 'f-250-super-duty',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '6.7L Power Stroke',
              slug: '6-7l-power-stroke',
              attributes: {
                displacementCc: 6700,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
            {
              name: '6.0L Power Stroke',
              slug: '6-0l-power-stroke',
              attributes: {
                displacementCc: 6000,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
          ],
        },
        {
          name: 'F-350 Super Duty',
          slug: 'f-350-super-duty',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '6.7L Power Stroke',
              slug: '6-7l-power-stroke',
              attributes: {
                displacementCc: 6700,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
            {
              name: '7.3L Power Stroke',
              slug: '7-3l-power-stroke',
              attributes: {
                displacementCc: 7300,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
          ],
        },
        {
          name: 'Mustang',
          slug: 'mustang',
          attributes: { bodyStyle: 'coupe' },
          children: [
            {
              name: '5.0L Coyote V8',
              slug: '5-0l-coyote-v8',
              attributes: {
                displacementCc: 5000,
                cylinders: 8,
                fuelType: 'gasoline',
                aspiration: 'natural',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'RAM',
      slug: 'ram',
      attributes: { countryOfOrigin: 'US' },
      children: [
        {
          name: '2500',
          slug: '2500',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '6.7L Cummins',
              slug: '6-7l-cummins',
              attributes: {
                displacementCc: 6700,
                cylinders: 6,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
          ],
        },
        {
          name: '3500',
          slug: '3500',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '6.7L Cummins HO',
              slug: '6-7l-cummins-ho',
              attributes: {
                displacementCc: 6700,
                cylinders: 6,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'Chevrolet',
      slug: 'chevrolet',
      attributes: { countryOfOrigin: 'US' },
      children: [
        {
          name: 'Silverado 2500HD',
          slug: 'silverado-2500hd',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '6.6L Duramax LML',
              slug: '6-6l-duramax-lml',
              attributes: {
                displacementCc: 6600,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
            {
              name: '6.6L Duramax L5P',
              slug: '6-6l-duramax-l5p',
              attributes: {
                displacementCc: 6600,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
          ],
        },
        {
          name: 'Silverado 3500HD',
          slug: 'silverado-3500hd',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '6.6L Duramax LML',
              slug: '6-6l-duramax-lml',
              attributes: {
                displacementCc: 6600,
                cylinders: 8,
                fuelType: 'diesel',
                aspiration: 'turbocharged',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'Toyota',
      slug: 'toyota',
      attributes: { countryOfOrigin: 'JP' },
      children: [
        {
          name: 'Tacoma',
          slug: 'tacoma',
          attributes: { bodyStyle: 'truck' },
          children: [
            {
              name: '3.5L V6',
              slug: '3-5l-v6',
              attributes: {
                displacementCc: 3500,
                cylinders: 6,
                fuelType: 'gasoline',
                aspiration: 'natural',
              },
            },
          ],
        },
      ],
    },
  ],
});

const DEVICE = fitmentDictionary({
  slug: 'device',
  name: 'Device',
  description: 'Phone & tablet fitment — Brand → Model, for cases, screens, and accessories.',
  iconKey: 'smartphone',
  tags: ['electronics', 'phone', 'tablet', 'case', 'accessory'],
  dimensions: [
    { key: 'brand', label: 'Brand', kind: 'level' },
    { key: 'model', label: 'Model', kind: 'level' },
  ],
  tree: [
    {
      name: 'Apple',
      slug: 'apple',
      attributes: { platform: 'ios' },
      children: [
        { name: 'iPhone 15 Pro Max', slug: 'iphone-15-pro-max', attributes: { screenSizeIn: 6.7 } },
        { name: 'iPhone 15 Pro', slug: 'iphone-15-pro', attributes: { screenSizeIn: 6.1 } },
        { name: 'iPhone 14', slug: 'iphone-14', attributes: { screenSizeIn: 6.1 } },
        { name: 'iPad Air (5th gen)', slug: 'ipad-air-5', attributes: { screenSizeIn: 10.9 } },
      ],
    },
    {
      name: 'Samsung',
      slug: 'samsung',
      attributes: { platform: 'android' },
      children: [
        { name: 'Galaxy S24 Ultra', slug: 'galaxy-s24-ultra', attributes: { screenSizeIn: 6.8 } },
        { name: 'Galaxy S24', slug: 'galaxy-s24', attributes: { screenSizeIn: 6.2 } },
        { name: 'Galaxy S23', slug: 'galaxy-s23', attributes: { screenSizeIn: 6.1 } },
      ],
    },
    {
      name: 'Google',
      slug: 'google',
      attributes: { platform: 'android' },
      children: [
        { name: 'Pixel 8 Pro', slug: 'pixel-8-pro', attributes: { screenSizeIn: 6.7 } },
        { name: 'Pixel 8', slug: 'pixel-8', attributes: { screenSizeIn: 6.2 } },
      ],
    },
  ],
});

const APPAREL = fitmentDictionary({
  slug: 'apparel-sizes',
  name: 'Apparel sizes',
  description: 'Clothing fitment — a single Size axis (alpha + numeric), no sub-levels.',
  iconKey: 'shirt',
  tags: ['clothing', 'fashion', 'size', 'retail'],
  dimensions: [{ key: 'size', label: 'Size', kind: 'level' }],
  tree: [
    { name: 'XXS', slug: 'xxs', attributes: { numericEquivalent: 0 } },
    { name: 'XS', slug: 'xs', attributes: { numericEquivalent: 2 } },
    { name: 'S', slug: 's', attributes: { numericEquivalent: 4 } },
    { name: 'M', slug: 'm', attributes: { numericEquivalent: 8 } },
    { name: 'L', slug: 'l', attributes: { numericEquivalent: 12 } },
    { name: 'XL', slug: 'xl', attributes: { numericEquivalent: 16 } },
    { name: 'XXL', slug: 'xxl', attributes: { numericEquivalent: 20 } },
    { name: '3XL', slug: '3xl', attributes: { numericEquivalent: 24 } },
  ],
});

const PET = fitmentDictionary({
  slug: 'pet',
  name: 'Pet',
  description: 'Pet fitment — Species → Breed, narrowable by body weight.',
  iconKey: 'paw-print',
  tags: ['pet', 'animal', 'collar', 'harness', 'apparel'],
  dimensions: [
    { key: 'species', label: 'Species', kind: 'level' },
    { key: 'breed', label: 'Breed', kind: 'level' },
    { key: 'weight', label: 'Weight', kind: 'range', unit: 'lb' },
  ],
  tree: [
    {
      name: 'Dog',
      slug: 'dog',
      attributes: { taxonomyClass: 'mammalia' },
      children: [
        {
          name: 'Labrador Retriever',
          slug: 'labrador-retriever',
          attributes: { breedGroup: 'sporting' },
        },
        {
          name: 'Golden Retriever',
          slug: 'golden-retriever',
          attributes: { breedGroup: 'sporting' },
        },
        { name: 'German Shepherd', slug: 'german-shepherd', attributes: { breedGroup: 'herding' } },
        {
          name: 'French Bulldog',
          slug: 'french-bulldog',
          attributes: { breedGroup: 'non-sporting' },
        },
        { name: 'Chihuahua', slug: 'chihuahua', attributes: { breedGroup: 'toy' } },
      ],
    },
    {
      name: 'Cat',
      slug: 'cat',
      attributes: { taxonomyClass: 'mammalia' },
      children: [
        { name: 'Maine Coon', slug: 'maine-coon' },
        { name: 'Siamese', slug: 'siamese' },
        { name: 'Domestic Shorthair', slug: 'domestic-shorthair' },
      ],
    },
  ],
});

const EQUIPMENT = fitmentDictionary({
  slug: 'equipment',
  name: 'Industrial equipment',
  description: 'Machinery fitment — Class → Model, for parts, filters, and wear items.',
  iconKey: 'construction',
  tags: ['industrial', 'machinery', 'parts', 'agriculture', 'construction'],
  dimensions: [
    { key: 'class', label: 'Class', kind: 'level' },
    { key: 'model', label: 'Model', kind: 'level' },
  ],
  tree: [
    {
      name: 'Forklift',
      slug: 'forklift',
      attributes: { powerType: 'electric/propane' },
      children: [
        { name: 'Toyota 8FGCU25', slug: 'toyota-8fgcu25', attributes: { capacityLb: 5000 } },
        { name: 'Hyster H50FT', slug: 'hyster-h50ft', attributes: { capacityLb: 5000 } },
      ],
    },
    {
      name: 'Generator',
      slug: 'generator',
      attributes: { powerType: 'diesel' },
      children: [
        { name: 'Generac SD080', slug: 'generac-sd080', attributes: { kw: 80 } },
        { name: 'Cummins C60D6', slug: 'cummins-c60d6', attributes: { kw: 60 } },
      ],
    },
    {
      name: 'Air compressor',
      slug: 'air-compressor',
      children: [
        { name: 'Ingersoll Rand 2475', slug: 'ingersoll-rand-2475', attributes: { hp: 5 } },
        { name: 'Quincy QT-54', slug: 'quincy-qt-54', attributes: { hp: 5 } },
      ],
    },
  ],
});

const FOOTWEAR = fitmentDictionary({
  slug: 'footwear',
  name: 'Footwear',
  description: 'Shoe fitment — Department → Width, narrowable by US shoe size.',
  iconKey: 'footprints',
  tags: ['shoes', 'footwear', 'size', 'retail', 'fashion'],
  dimensions: [
    { key: 'department', label: 'Department', kind: 'level' },
    { key: 'width', label: 'Width', kind: 'level' },
    { key: 'size', label: 'Size', kind: 'range', unit: 'us_shoe' },
  ],
  tree: [
    {
      name: "Men's",
      slug: 'mens',
      children: [
        { name: 'Narrow (B)', slug: 'narrow-b' },
        { name: 'Medium (D)', slug: 'medium-d' },
        { name: 'Wide (2E)', slug: 'wide-2e' },
      ],
    },
    {
      name: "Women's",
      slug: 'womens',
      children: [
        { name: 'Narrow (AA)', slug: 'narrow-aa' },
        { name: 'Medium (B)', slug: 'medium-b' },
        { name: 'Wide (D)', slug: 'wide-d' },
      ],
    },
    {
      name: 'Kids',
      slug: 'kids',
      children: [
        { name: 'Medium (M)', slug: 'medium-m' },
        { name: 'Wide (W)', slug: 'wide-w' },
      ],
    },
  ],
});

const BICYCLE = fitmentDictionary({
  slug: 'bicycle',
  name: 'Bicycle',
  description: 'Bike fitment — Discipline → Wheel size, for tires, tubes, and components.',
  iconKey: 'bike',
  tags: ['cycling', 'bike', 'tire', 'component', 'outdoor'],
  dimensions: [
    { key: 'discipline', label: 'Discipline', kind: 'level' },
    { key: 'wheel_size', label: 'Wheel size', kind: 'level' },
  ],
  tree: [
    {
      name: 'Road',
      slug: 'road',
      children: [
        { name: '700c', slug: '700c', attributes: { isoBsd: 622 } },
        { name: '650b', slug: '650b', attributes: { isoBsd: 584 } },
      ],
    },
    {
      name: 'Mountain',
      slug: 'mountain',
      children: [
        { name: '29 in', slug: '29in', attributes: { isoBsd: 622 } },
        { name: '27.5 in', slug: '27-5in', attributes: { isoBsd: 584 } },
        { name: '26 in', slug: '26in', attributes: { isoBsd: 559 } },
      ],
    },
    {
      name: 'Gravel',
      slug: 'gravel',
      children: [{ name: '700c', slug: '700c', attributes: { isoBsd: 622 } }],
    },
    {
      name: 'Kids',
      slug: 'kids',
      children: [
        { name: '20 in', slug: '20in', attributes: { isoBsd: 406 } },
        { name: '16 in', slug: '16in', attributes: { isoBsd: 305 } },
      ],
    },
  ],
});

const EYEWEAR = fitmentDictionary({
  slug: 'eyewear',
  name: 'Eyewear',
  description: 'Glasses & sunglasses fitment — Brand → Frame, for lenses and parts.',
  iconKey: 'glasses',
  tags: ['eyewear', 'glasses', 'sunglasses', 'optical', 'lens'],
  dimensions: [
    { key: 'brand', label: 'Brand', kind: 'level' },
    { key: 'frame', label: 'Frame', kind: 'level' },
  ],
  tree: [
    {
      name: 'Ray-Ban',
      slug: 'ray-ban',
      children: [
        { name: 'Wayfarer', slug: 'wayfarer', attributes: { lensWidthMm: 50 } },
        { name: 'Aviator', slug: 'aviator', attributes: { lensWidthMm: 58 } },
      ],
    },
    {
      name: 'Oakley',
      slug: 'oakley',
      children: [
        { name: 'Holbrook', slug: 'holbrook', attributes: { lensWidthMm: 55 } },
        { name: 'Radar EV', slug: 'radar-ev', attributes: { lensWidthMm: 62 } },
      ],
    },
    {
      name: 'Warby Parker',
      slug: 'warby-parker',
      children: [{ name: 'Haskell', slug: 'haskell', attributes: { lensWidthMm: 52 } }],
    },
  ],
});

const TIRES_WHEELS = fitmentDictionary({
  slug: 'tires-wheels',
  name: 'Tires & wheels',
  description: 'Tire & wheel fitment — Rim diameter → Section width.',
  iconKey: 'disc',
  tags: ['tire', 'wheel', 'automotive', 'size'],
  dimensions: [
    { key: 'rim_diameter', label: 'Rim diameter', kind: 'level' },
    { key: 'section_width', label: 'Section width', kind: 'level' },
  ],
  tree: [
    {
      name: '16"',
      slug: '16in',
      children: [
        { name: '205 mm', slug: '205', attributes: { sectionWidthMm: 205 } },
        { name: '225 mm', slug: '225', attributes: { sectionWidthMm: 225 } },
      ],
    },
    {
      name: '17"',
      slug: '17in',
      children: [
        { name: '225 mm', slug: '225', attributes: { sectionWidthMm: 225 } },
        { name: '245 mm', slug: '245', attributes: { sectionWidthMm: 245 } },
      ],
    },
    {
      name: '18"',
      slug: '18in',
      children: [
        { name: '245 mm', slug: '245', attributes: { sectionWidthMm: 245 } },
        { name: '275 mm', slug: '275', attributes: { sectionWidthMm: 275 } },
      ],
    },
    {
      name: '20"',
      slug: '20in',
      children: [{ name: '275 mm', slug: '275', attributes: { sectionWidthMm: 275 } }],
    },
  ],
});

const HVAC_FILTERS = fitmentDictionary({
  slug: 'hvac-filters',
  name: 'HVAC filters',
  description: 'Air-filter fitment — a single Nominal size axis (W×H×D inches).',
  iconKey: 'air-vent',
  tags: ['hvac', 'filter', 'home', 'maintenance'],
  dimensions: [{ key: 'nominal_size', label: 'Nominal size', kind: 'level' }],
  tree: [
    { name: '16×20×1', slug: '16x20x1', attributes: { widthIn: 16, heightIn: 20, depthIn: 1 } },
    { name: '16×25×1', slug: '16x25x1', attributes: { widthIn: 16, heightIn: 25, depthIn: 1 } },
    { name: '20×20×1', slug: '20x20x1', attributes: { widthIn: 20, heightIn: 20, depthIn: 1 } },
    { name: '20×25×1', slug: '20x25x1', attributes: { widthIn: 20, heightIn: 25, depthIn: 1 } },
    { name: '20×25×4', slug: '20x25x4', attributes: { widthIn: 20, heightIn: 25, depthIn: 4 } },
    { name: '16×25×4', slug: '16x25x4', attributes: { widthIn: 16, heightIn: 25, depthIn: 4 } },
  ],
});

const FURNITURE = fitmentDictionary({
  slug: 'furniture',
  name: 'Furniture',
  description: 'Furniture fitment — Room → Piece, for covers, cushions, and parts.',
  iconKey: 'sofa',
  tags: ['furniture', 'home', 'cover', 'cushion'],
  dimensions: [
    { key: 'room', label: 'Room', kind: 'level' },
    { key: 'piece', label: 'Piece', kind: 'level' },
  ],
  tree: [
    {
      name: 'Living room',
      slug: 'living-room',
      children: [
        { name: 'Sofa (3-seat)', slug: 'sofa-3-seat' },
        { name: 'Loveseat', slug: 'loveseat' },
        { name: 'Recliner', slug: 'recliner' },
      ],
    },
    {
      name: 'Dining',
      slug: 'dining',
      children: [
        { name: 'Dining chair', slug: 'dining-chair' },
        { name: 'Bar stool', slug: 'bar-stool' },
      ],
    },
    {
      name: 'Office',
      slug: 'office',
      children: [{ name: 'Task chair', slug: 'task-chair' }],
    },
  ],
});

const MARINE_POWERSPORTS = fitmentDictionary({
  slug: 'marine-powersports',
  name: 'Marine & powersports',
  description: 'Boat, ATV & moto fitment — Make → Model, narrowable by year.',
  iconKey: 'ship',
  tags: ['marine', 'boat', 'atv', 'motorcycle', 'powersports'],
  dimensions: [
    { key: 'make', label: 'Make', kind: 'level' },
    { key: 'model', label: 'Model', kind: 'level' },
    { key: 'year', label: 'Year', kind: 'range', unit: 'year' },
  ],
  tree: [
    {
      name: 'Sea-Doo',
      slug: 'sea-doo',
      attributes: { vehicleType: 'pwc' },
      children: [
        { name: 'GTI 130', slug: 'gti-130' },
        { name: 'RXP-X 300', slug: 'rxp-x-300' },
      ],
    },
    {
      name: 'Polaris',
      slug: 'polaris',
      attributes: { vehicleType: 'atv' },
      children: [
        { name: 'Sportsman 570', slug: 'sportsman-570' },
        { name: 'RZR XP 1000', slug: 'rzr-xp-1000' },
      ],
    },
    {
      name: 'Yamaha',
      slug: 'yamaha',
      attributes: { vehicleType: 'motorcycle' },
      children: [
        { name: 'YZ250F', slug: 'yz250f' },
        { name: 'MT-07', slug: 'mt-07' },
      ],
    },
  ],
});

const INSTRUMENTS = fitmentDictionary({
  slug: 'instruments',
  name: 'Musical instruments',
  description: 'Instrument fitment — Family → Instrument, for strings, reeds, and parts.',
  iconKey: 'guitar',
  tags: ['music', 'instrument', 'strings', 'accessory'],
  dimensions: [
    { key: 'family', label: 'Family', kind: 'level' },
    { key: 'instrument', label: 'Instrument', kind: 'level' },
  ],
  tree: [
    {
      name: 'Strings',
      slug: 'strings',
      children: [
        { name: 'Acoustic guitar', slug: 'acoustic-guitar' },
        { name: 'Electric guitar', slug: 'electric-guitar' },
        { name: 'Violin', slug: 'violin' },
        { name: 'Bass guitar', slug: 'bass-guitar' },
      ],
    },
    {
      name: 'Woodwind',
      slug: 'woodwind',
      children: [
        { name: 'Clarinet', slug: 'clarinet' },
        { name: 'Alto saxophone', slug: 'alto-saxophone' },
      ],
    },
    {
      name: 'Percussion',
      slug: 'percussion',
      children: [{ name: 'Snare drum', slug: 'snare-drum' }],
    },
  ],
});

const APPLIANCES = fitmentDictionary({
  slug: 'appliances',
  name: 'Home appliances',
  description: 'Appliance fitment — Category → Brand, for parts, filters, and seals.',
  iconKey: 'washing-machine',
  tags: ['appliance', 'home', 'part', 'filter', 'repair'],
  dimensions: [
    { key: 'category', label: 'Category', kind: 'level' },
    { key: 'brand', label: 'Brand', kind: 'level' },
  ],
  tree: [
    {
      name: 'Refrigerator',
      slug: 'refrigerator',
      children: [
        { name: 'Whirlpool', slug: 'whirlpool' },
        { name: 'LG', slug: 'lg' },
        { name: 'Samsung', slug: 'samsung' },
      ],
    },
    {
      name: 'Washer',
      slug: 'washer',
      children: [
        { name: 'Maytag', slug: 'maytag' },
        { name: 'GE', slug: 'ge' },
      ],
    },
    {
      name: 'Dishwasher',
      slug: 'dishwasher',
      children: [{ name: 'Bosch', slug: 'bosch' }],
    },
  ],
});

/** The published library, in picker order. */
export const FITMENT_DICTIONARIES: FitmentDictionary[] = [
  VEHICLE,
  APPAREL,
  FOOTWEAR,
  DEVICE,
  PET,
  EQUIPMENT,
  BICYCLE,
  EYEWEAR,
  TIRES_WHEELS,
  HVAC_FILTERS,
  FURNITURE,
  MARINE_POWERSPORTS,
  INSTRUMENTS,
  APPLIANCES,
];

export function getFitmentDictionary(slug: string): FitmentDictionary | undefined {
  return FITMENT_DICTIONARIES.find((d) => d.slug === slug);
}

// ─── Picker summary (no tree) ─────────────────────────────────────────

export interface FitmentDictionarySummary {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  /** Full dimension list — the picker derives the level chain + range axes. */
  dimensions: FitmentDimension[];
  /** Top-level node count, e.g. "4 makes" (label = first level dimension). */
  rootCount: number;
  /** First few top-level node names for an at-a-glance preview. */
  sampleRoots: string[];
}

export function fitmentDictionarySummary(d: FitmentDictionary): FitmentDictionarySummary {
  return {
    slug: d.slug,
    name: d.name,
    description: d.description,
    iconKey: d.iconKey,
    tags: d.tags,
    dimensions: d.dimensions,
    rootCount: d.tree.length,
    sampleRoots: d.tree.slice(0, 4).map((n) => n.name),
  };
}

export function listFitmentDictionarySummaries(): FitmentDictionarySummary[] {
  return FITMENT_DICTIONARIES.map(fitmentDictionarySummary);
}

// ─── Stamping planner (the single install codepath) ───────────────────

export interface PlannedFitmentDomainRow {
  id: string;
  tenantId: string;
  slug: string;
  displayName: string;
  description: string;
  iconKey: string;
  dimensions: FitmentDimension[];
  position: number;
}

export interface PlannedFitmentNodeRow {
  id: string;
  tenantId: string;
  domainId: string;
  parentId: string | null;
  dimensionKey: string;
  name: string;
  slug: string;
  attributes: Record<string, string | number>;
  /** Ancestor ids incl. self, root → self. Drives ancestor/descendant filtering. */
  path: string[];
  /** Ancestor names incl. self, root → self. Powers name-based collection rules. */
  pathNames: string[];
  depth: number;
  position: number;
}

export interface PlannedFitmentRows {
  domain: PlannedFitmentDomainRow;
  nodes: PlannedFitmentNodeRow[];
  index: {
    domainId: string;
    /** Ordered `level` dimension keys (tree depth order). */
    levelKeys: string[];
    /** Ordered `range` dimension keys. */
    rangeKeys: string[];
    /** Slug path (`ford/f-250-super-duty/6-7l-power-stroke`) → node id. */
    nodeIdByPath: Record<string, string>;
  };
}

/**
 * Turn a dictionary into the exact rows to insert for `tenantId`, with
 * pre-generated ids (via the injected `newId`, e.g. `crypto.randomUUID`) and
 * materialized path/pathNames so nodes `createMany` in bulk and product links
 * resolve by slug path. Pure — no DB, no side effects — so the install service
 * and the demo seed share one stamping codepath and produce identical trees.
 */
export function planFitmentDictionaryRows(
  dict: FitmentDictionary,
  tenantId: string,
  newId: () => string
): PlannedFitmentRows {
  const domainId = newId();
  const levelKeys = dict.dimensions.filter((d) => d.kind === 'level').map((d) => d.key);
  const rangeKeys = dict.dimensions.filter((d) => d.kind === 'range').map((d) => d.key);
  const fallbackKey = levelKeys[0] ?? 'level';
  const nodes: PlannedFitmentNodeRow[] = [];
  const nodeIdByPath: Record<string, string> = {};

  const walk = (
    authored: FitmentDictionaryNode[],
    depth: number,
    parentId: string | null,
    parentPath: string[],
    parentPathNames: string[],
    parentSlugPath: string
  ): void => {
    authored.forEach((node, i) => {
      const id = newId();
      const slugPath = parentSlugPath ? `${parentSlugPath}/${node.slug}` : node.slug;
      const path = [...parentPath, id];
      const pathNames = [...parentPathNames, node.name];
      // depth maps to the level dimension at that tier; clamp defensively.
      const dimensionKey = levelKeys[depth] ?? fallbackKey;
      nodeIdByPath[slugPath] = id;
      nodes.push({
        id,
        tenantId,
        domainId,
        parentId,
        dimensionKey,
        name: node.name,
        slug: node.slug,
        attributes: node.attributes ?? {},
        path,
        pathNames,
        depth,
        position: i,
      });
      if (node.children?.length) {
        walk(node.children, depth + 1, id, path, pathNames, slugPath);
      }
    });
  };
  walk(dict.tree, 0, null, [], [], '');

  return {
    domain: {
      id: domainId,
      tenantId,
      slug: dict.slug,
      displayName: dict.name,
      description: dict.description,
      iconKey: dict.iconKey,
      dimensions: dict.dimensions,
      position: 0,
    },
    nodes,
    index: { domainId, levelKeys, rangeKeys, nodeIdByPath },
  };
}
