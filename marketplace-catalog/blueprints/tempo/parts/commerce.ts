// Tempo — commerce catalog (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  categories: [
    {
      handle: 'originals',
      name: 'Originals',
      description: 'Heritage and lifestyle sneakers — the icons, in their original cut.',
      featured: true,
      position: 0,
    },
    {
      handle: 'running',
      name: 'Running',
      description: 'Daily trainers, tempo shoes and trail runners engineered to move.',
      featured: true,
      position: 1,
    },
    {
      handle: 'soccer',
      name: 'Soccer',
      description: 'Boots, turf trainers and match equipment built for the pitch.',
      featured: true,
      position: 2,
    },
    {
      handle: 'lifestyle',
      name: 'Lifestyle',
      description: 'Jerseys, tees and track tops — terrace style for every day.',
      featured: true,
      position: 3,
    },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best Sellers',
      description: 'The styles our customers reach for first — restocked and ready.',
      type: 'manual',
      featured: true,
      productHandles: ['vega-og', 'glide-boost', 'halt-lo', 'strike-elite-fg', 'terrace-tee'],
    },
    {
      handle: 'new-arrivals',
      name: 'New & Trending',
      description: 'Fresh drops and the styles climbing the charts this week.',
      type: 'manual',
      featured: true,
      productHandles: ['vega-og', 'field-bold', 'pulse-rise', 'strike-pro-tf', 'club-jersey'],
    },
  ],
  products: [
    {
      handle: 'vega-og',
      title: 'Vega OG',
      description:
        'The terrace classic, back in its original cut — soft suede overlays, a gum sole, and the clean low profile that started it all.',
      status: 'draft',
      productType: 'Shoes',
      vendor: 'Tempo',
      tags: ['heritage', 'lifestyle'],
      categoryHandles: ['originals'],
      collectionHandles: ['best-sellers', 'new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'VEGAOG-8',
          priceCents: 10000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'VEGAOG-9',
          priceCents: 10000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'VEGAOG-10',
          priceCents: 10000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'VEGAOG-11',
          priceCents: 10000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-vega-og',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'halt-lo',
      title: 'Halt Lo',
      description:
        'A low-top court shoe with a full-grain leather upper and a vulcanized sole — built for the street, styled for everywhere.',
      status: 'draft',
      productType: 'Shoes',
      vendor: 'Tempo',
      tags: ['court', 'sale'],
      categoryHandles: ['originals'],
      collectionHandles: ['best-sellers'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'HALTLO-8',
          priceCents: 9000,
          compareAtPriceCents: 12000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'HALTLO-9',
          priceCents: 9000,
          compareAtPriceCents: 12000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'HALTLO-10',
          priceCents: 9000,
          compareAtPriceCents: 12000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'HALTLO-11',
          priceCents: 9000,
          compareAtPriceCents: 12000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-halt-lo',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'field-bold',
      title: 'Field Bold',
      description:
        'A bold heritage runner reissue — nubuck and mesh, a chunky midsole, and a colorway pulled straight from the archive.',
      status: 'draft',
      productType: 'Shoes',
      vendor: 'Tempo',
      tags: ['heritage'],
      categoryHandles: ['originals'],
      collectionHandles: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'FIELDBOLD-8',
          priceCents: 12000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'FIELDBOLD-9',
          priceCents: 12000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'FIELDBOLD-10',
          priceCents: 12000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'FIELDBOLD-11',
          priceCents: 12000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-field-bold',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'glide-boost',
      title: 'Glide Boost',
      description:
        'Our most-cushioned daily trainer — a responsive energy-return midsole and a knit upper that moves with every stride.',
      status: 'draft',
      productType: 'Shoes',
      vendor: 'Tempo',
      tags: ['running', 'cushioned'],
      categoryHandles: ['running'],
      collectionHandles: ['best-sellers'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'GLIDEBOOST-8',
          priceCents: 19000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'GLIDEBOOST-9',
          priceCents: 19000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'GLIDEBOOST-10',
          priceCents: 19000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'GLIDEBOOST-11',
          priceCents: 19000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-glide-boost',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'pulse-rise',
      title: 'Pulse Rise',
      description:
        'A lightweight tempo shoe for fast days — a breathable upper, a propulsive plate, and a grippy outsole for the road.',
      status: 'draft',
      productType: 'Shoes',
      vendor: 'Tempo',
      tags: ['running', 'tempo'],
      categoryHandles: ['running'],
      collectionHandles: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'PULSERISE-8',
          priceCents: 14000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'PULSERISE-9',
          priceCents: 14000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'PULSERISE-10',
          priceCents: 14000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'PULSERISE-11',
          priceCents: 14000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-pulse-rise',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'trail-storm',
      title: 'Trail Storm',
      description:
        'A rugged trail runner with a weather-ready upper and aggressive lugs — engineered to hold the line on any terrain.',
      status: 'draft',
      productType: 'Shoes',
      vendor: 'Tempo',
      tags: ['trail', 'outdoor'],
      categoryHandles: ['running'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'TRAILSTORM-8',
          priceCents: 16000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'TRAILSTORM-9',
          priceCents: 16000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'TRAILSTORM-10',
          priceCents: 16000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'TRAILSTORM-11',
          priceCents: 16000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-trail-storm',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'strike-elite-fg',
      title: 'Strike Elite FG',
      description:
        'The firm-ground boot the pros wear — a second-skin upper, a precision soleplate, and a strike zone tuned for power.',
      status: 'draft',
      productType: 'Cleats',
      vendor: 'Tempo',
      tags: ['soccer', 'firm-ground'],
      categoryHandles: ['soccer'],
      collectionHandles: ['best-sellers'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'STRIKEELIT-8',
          priceCents: 28000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'STRIKEELIT-9',
          priceCents: 28000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'STRIKEELIT-10',
          priceCents: 28000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'STRIKEELIT-11',
          priceCents: 28000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-strike-elite-fg',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'strike-pro-tf',
      title: 'Strike Pro TF',
      description:
        'A turf trainer built for the cage — a durable coated upper and a multi-stud outsole for grip on hard ground.',
      status: 'draft',
      productType: 'Cleats',
      vendor: 'Tempo',
      tags: ['soccer', 'turf', 'sale'],
      categoryHandles: ['soccer'],
      collectionHandles: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: '8',
              position: 0,
            },
            {
              value: '9',
              position: 1,
            },
            {
              value: '10',
              position: 2,
            },
            {
              value: '11',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'STRIKEPROT-8',
          priceCents: 12000,
          compareAtPriceCents: 15000,
          optionValues: {
            Size: '8',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'STRIKEPROT-9',
          priceCents: 12000,
          compareAtPriceCents: 15000,
          optionValues: {
            Size: '9',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 1,
        },
        {
          sku: 'STRIKEPROT-10',
          priceCents: 12000,
          compareAtPriceCents: 15000,
          optionValues: {
            Size: '10',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 2,
        },
        {
          sku: 'STRIKEPROT-11',
          priceCents: 12000,
          compareAtPriceCents: 15000,
          optionValues: {
            Size: '11',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-strike-pro-tf',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'match-ball-pro',
      title: 'Match Ball Pro',
      description:
        'A thermally-bonded match ball with a seamless surface for a true, predictable flight — official size and weight.',
      status: 'draft',
      productType: 'Equipment',
      vendor: 'Tempo',
      tags: ['soccer', 'equipment'],
      categoryHandles: ['soccer'],
      options: [],
      variants: [
        {
          sku: 'MATCHBALLP',
          priceCents: 4000,
          inventoryPolicy: 'continue',
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-match-ball-pro',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'club-jersey',
      title: 'Club Jersey',
      description:
        'A moisture-wicking match jersey with a relaxed fit and a heat-pressed crest — built for the stands or the pitch.',
      status: 'draft',
      productType: 'Apparel',
      vendor: 'Tempo',
      tags: ['jersey', 'apparel'],
      categoryHandles: ['lifestyle'],
      collectionHandles: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: 'S',
              position: 0,
            },
            {
              value: 'M',
              position: 1,
            },
            {
              value: 'L',
              position: 2,
            },
            {
              value: 'XL',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'CLUBJERSEY-S',
          priceCents: 9000,
          optionValues: {
            Size: 'S',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'CLUBJERSEY-M',
          priceCents: 9000,
          optionValues: {
            Size: 'M',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 1,
        },
        {
          sku: 'CLUBJERSEY-L',
          priceCents: 9000,
          optionValues: {
            Size: 'L',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 2,
        },
        {
          sku: 'CLUBJERSEY-XL',
          priceCents: 9000,
          optionValues: {
            Size: 'XL',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-club-jersey',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'terrace-tee',
      title: 'Terrace Tee',
      description:
        'A heavyweight cotton tee with the motion-mark on the chest — the everyday staple, cut a little boxy.',
      status: 'draft',
      productType: 'Apparel',
      vendor: 'Tempo',
      tags: ['tee', 'apparel'],
      categoryHandles: ['lifestyle'],
      collectionHandles: ['best-sellers'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: 'S',
              position: 0,
            },
            {
              value: 'M',
              position: 1,
            },
            {
              value: 'L',
              position: 2,
            },
            {
              value: 'XL',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'TERRACETEE-S',
          priceCents: 3500,
          optionValues: {
            Size: 'S',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'TERRACETEE-M',
          priceCents: 3500,
          optionValues: {
            Size: 'M',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 1,
        },
        {
          sku: 'TERRACETEE-L',
          priceCents: 3500,
          optionValues: {
            Size: 'L',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 2,
        },
        {
          sku: 'TERRACETEE-XL',
          priceCents: 3500,
          optionValues: {
            Size: 'XL',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-terrace-tee',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'field-track-jacket',
      title: 'Field Track Jacket',
      description:
        'The original three-zone track jacket — a slim fit, ribbed cuffs, and a stand collar that never goes out of style.',
      status: 'draft',
      productType: 'Apparel',
      vendor: 'Tempo',
      tags: ['jacket', 'apparel'],
      categoryHandles: ['lifestyle'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [
            {
              value: 'S',
              position: 0,
            },
            {
              value: 'M',
              position: 1,
            },
            {
              value: 'L',
              position: 2,
            },
            {
              value: 'XL',
              position: 3,
            },
          ],
        },
      ],
      variants: [
        {
          sku: 'FIELDTRACK-S',
          priceCents: 11000,
          optionValues: {
            Size: 'S',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 0,
        },
        {
          sku: 'FIELDTRACK-M',
          priceCents: 11000,
          optionValues: {
            Size: 'M',
          },
          inventoryPolicy: 'continue',
          isDefault: true,
          position: 1,
        },
        {
          sku: 'FIELDTRACK-L',
          priceCents: 11000,
          optionValues: {
            Size: 'L',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 2,
        },
        {
          sku: 'FIELDTRACK-XL',
          priceCents: 11000,
          optionValues: {
            Size: 'XL',
          },
          inventoryPolicy: 'continue',
          isDefault: false,
          position: 3,
        },
      ],
      images: [
        {
          assetId: 'img-field-track-jacket',
          isPrimary: true,
        },
      ],
    },
  ],
};
