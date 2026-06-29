// Electronics sample pack — a consumer gadget shop. Data-as-code: rich products
// (earbuds, keyboards, storage, smart home, power) with real specs + reviews + Q&A,
// an inventory ledger across one warehouse with a supplier, retail tech buyers, a
// work-from-home kit bundle, a custom-keyboard configurator, and buying guides. One
// product is deliberately sold out to exercise the out-of-stock state.
//
// Pairs with the `electronics` industry STARTER (tax/shipping/markup config); this
// pack brings the catalog + activity that makes the whole platform feel alive.

import { doc, h2, ol, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const electronicsPack: SampleDataPack = {
  industry: 'electronics',
  label: 'Electronics & tech',
  summary:
    'A consumer gadget shop: a stocked catalog of audio, peripherals, storage, smart home, and power, with retail buyers, orders + returns, verified reviews, a work-from-home bundle, a custom-keyboard configurator, and buying guides.',

  warehouses: [
    {
      key: 'MAIN',
      code: 'MAIN',
      name: 'Fulfillment Center',
      type: 'owned',
      city: 'Hillsboro',
      region: 'OR',
    },
  ],

  suppliers: [
    {
      code: 'GLOBALTECH',
      name: 'GlobalTech Distribution',
      paymentTerms: 'net30',
      leadTimeDays: 18,
      city: 'San Jose',
      region: 'CA',
      variantKeys: [
        'EAR-PULSE-BLK',
        'EAR-PULSE-WHT',
        'KB-AERO-TKL',
        'HUB-USBC-8N1',
        'SSD-VLT-1TB',
        'SSD-VLT-2TB',
        'BULB-LUMA-A19',
        'PWR-CHG-20K',
        'STAND-RISE-ALU',
        'SPK-BOOM-MINI',
        'MSE-RAPTOR-WL',
      ],
    },
  ],

  categories: [
    { key: 'audio', name: 'Audio', handle: 'audio' },
    { key: 'peripherals', name: 'Peripherals', handle: 'peripherals' },
    { key: 'storage', name: 'Storage', handle: 'storage' },
    { key: 'smart-home', name: 'Smart Home', handle: 'smart-home' },
    { key: 'power', name: 'Power & Charging', handle: 'power-charging' },
  ],

  collections: [
    { key: 'best-sellers', name: 'Best Sellers', handle: 'best-sellers', featured: true },
    { key: 'new-arrivals', name: 'New Arrivals', handle: 'new-arrivals' },
    { key: 'deals', name: 'Deals', handle: 'deals' },
  ],

  personas: [
    {
      key: 'jordan',
      name: 'Jordan Avery',
      email: 'jordan.avery',
      phone: '+1-503-555-0148',
      line1: '1422 NW Quimby St',
      city: 'Portland',
      region: 'OR',
      postalCode: '97209',
    },
    {
      key: 'mei',
      name: 'Mei Tanaka',
      email: 'mei.tanaka',
      phone: '+1-206-555-0173',
      line1: '88 Boren Ave N',
      city: 'Seattle',
      region: 'WA',
      postalCode: '98109',
    },
    {
      key: 'devin',
      name: 'Devin Brooks',
      email: 'devin.brooks',
      phone: '+1-512-555-0191',
      line1: '2310 E Cesar Chavez St',
      city: 'Austin',
      region: 'TX',
      postalCode: '78702',
    },
    {
      key: 'sophia',
      name: 'Sophia Reyes',
      email: 'sophia.reyes',
      phone: '+1-305-555-0126',
      line1: '760 NE 69th St',
      city: 'Miami',
      region: 'FL',
      postalCode: '33138',
    },
    {
      key: 'noah',
      name: 'Noah Bergstrom',
      email: 'noah.bergstrom',
      phone: '+1-612-555-0159',
      line1: '415 1st Ave NE',
      city: 'Minneapolis',
      region: 'MN',
      postalCode: '55413',
    },
    {
      key: 'aisha',
      name: 'Aisha Karim',
      email: 'aisha.karim',
      phone: '+1-617-555-0137',
      line1: '93 Marlborough St',
      city: 'Boston',
      region: 'MA',
      postalCode: '02116',
    },
  ],

  products: [
    {
      key: 'earbuds-pulse',
      title: 'Pulse Pro Wireless Earbuds',
      handle: 'pulse-pro-wireless-earbuds',
      description:
        '<p>Active noise-cancelling true-wireless earbuds with dual-driver acoustics and adaptive transparency mode. Six microphones with a wind-reduction mesh keep your voice clear on calls, and the low-latency game mode drops audio lag to 60ms so the sound matches what is on screen.</p><p>Eight hours of playback per charge and 32 total with the pocketable case, plus USB-C and Qi wireless charging. IPX5 sweat resistance and three sizes of ear tips mean they stay put through a run or a commute.</p>',
      productType: 'Earbuds',
      vendor: 'Soundwave',
      tags: ['earbuds', 'wireless', 'noise cancelling', 'bluetooth'],
      seoTitle: 'Pulse Pro Wireless Earbuds — ANC, 32hr Battery',
      seoDescription:
        'Dual-driver true-wireless earbuds with active noise cancelling, transparency mode, and 32 hours total battery. IPX5, USB-C + Qi charging.',
      categoryKeys: ['audio'],
      collectionKeys: ['best-sellers', 'new-arrivals'],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Midnight Black', swatchHex: '#1A1A1E' },
            { value: 'Cloud White', swatchHex: '#F2F1EC' },
          ],
        },
      ],
      variants: [
        {
          sku: 'EAR-PULSE-BLK',
          title: 'Midnight Black',
          priceCents: 14999,
          compareAtPriceCents: 17999,
          costCents: 6400,
          optionValues: ['Midnight Black'],
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 18,
              movements: [
                { delta: 200, reason: 'receive', daysAgo: 26 },
                { delta: -38, reason: 'sale', daysAgo: 11 },
                { delta: -27, reason: 'sale', daysAgo: 4 },
                { delta: -2, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          sku: 'EAR-PULSE-WHT',
          title: 'Cloud White',
          priceCents: 14999,
          compareAtPriceCents: 17999,
          costCents: 6400,
          optionValues: ['Cloud White'],
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 18,
              movements: [
                { delta: 160, reason: 'receive', daysAgo: 26 },
                { delta: -31, reason: 'sale', daysAgo: 9 },
                { delta: -14, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'ANC punches above the price',
          body: 'Wore these on a five-hour flight and the engine roar just disappeared. Calls are clear too — my team stopped asking me to repeat myself.',
          authorPersona: 'jordan',
          response: 'Thanks Jordan — glad they earned a spot in the travel bag!',
          helpfulCount: 14,
          daysAgo: 19,
        },
        {
          rating: 4,
          title: 'Great sound, fiddly touch controls',
          body: 'Audio is rich and the case is tiny. Only gripe is the touch controls trigger when I adjust the fit, but you get used to it.',
          authorPersona: 'mei',
          helpfulCount: 6,
          daysAgo: 12,
        },
        {
          rating: 5,
          title: 'Game mode actually works',
          body: 'The low-latency mode is real — no more lip-sync lag watching video or in mobile games. Battery easily gets me through the day.',
          displayName: 'PixelPusher',
          helpfulCount: 3,
          daysAgo: 6,
        },
        {
          rating: 2,
          title: 'Left bud died after two weeks',
          body: 'Loved them at first but the left earbud stopped charging. Reaching out to support to see about a swap.',
          displayName: 'AnonListener',
          status: 'pending',
          helpfulCount: 1,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Do these support multipoint — can I pair my laptop and phone at the same time?',
          authorPersona: 'devin',
          answer:
            'Yes, Pulse Pro supports two simultaneous connections. Pair both from the app and audio auto-switches to whichever device starts playing.',
          daysAgo: 15,
        },
        {
          body: 'Is the case Qi wireless charging or USB-C only?',
          displayName: 'DeskSetup99',
          status: 'pending',
          daysAgo: 3,
        },
      ],
    },
    {
      key: 'keyboard-aero',
      title: 'Aero TKL Mechanical Keyboard',
      handle: 'aero-tkl-mechanical-keyboard',
      description:
        '<p>A hot-swappable tenkeyless mechanical keyboard with a gasket-mounted plate and sound-dampening foam, tuned for a deep, muted typing feel right out of the box. Pre-lubed linear switches and PBT double-shot keycaps mean it sounds and feels finished — no aftermarket mods required.</p><p>Connect over 2.4GHz wireless, Bluetooth for up to three devices, or USB-C wired with full N-key rollover. Per-key RGB and onboard memory let you carry your layout and lighting between machines without software.</p>',
      productType: 'Keyboard',
      vendor: 'Keychron Forge',
      tags: ['keyboard', 'mechanical', 'hot-swap', 'tkl', 'rgb'],
      seoTitle: 'Aero TKL Hot-Swappable Mechanical Keyboard',
      seoDescription:
        'Gasket-mounted tenkeyless mechanical keyboard with hot-swap switches, PBT keycaps, and triple-mode wireless. Pre-lubed and ready to type.',
      categoryKeys: ['peripherals'],
      collectionKeys: ['best-sellers'],
      variants: [
        {
          sku: 'KB-AERO-TKL',
          title: null,
          priceCents: 11999,
          costCents: 5800,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 18,
              movements: [
                { delta: 140, reason: 'receive', daysAgo: 30 },
                { delta: -29, reason: 'sale', daysAgo: 13 },
                { delta: -22, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Sounds incredible out of the box',
          body: 'I expected to mod it but it is already thocky and quiet. The gasket mount has just enough flex. Hot-swap meant I tried tactiles later without a soldering iron.',
          authorPersona: 'devin',
          response:
            'Appreciate the writeup, Devin — that pre-lubed feel is exactly what we tuned for.',
          helpfulCount: 11,
          daysAgo: 17,
        },
        {
          rating: 4,
          title: 'Wireless is solid, software less so',
          body: 'Connection is rock-steady on 2.4GHz and the battery lasts ages. The companion app is a little clunky but onboard memory means I rarely open it.',
          authorPersona: 'noah',
          helpfulCount: 5,
          daysAgo: 10,
        },
        {
          rating: 5,
          title: 'My first mechanical and I am hooked',
          body: 'Came from a membrane board and the difference is night and day. Typing all day is genuinely more comfortable.',
          displayName: 'FirstBuild',
          status: 'flagged',
          helpfulCount: 2,
          daysAgo: 4,
        },
      ],
      questions: [
        {
          body: 'Will it work with a Mac, including the command and option keys?',
          authorPersona: 'mei',
          answer:
            'Yes — there is a Mac/Windows toggle switch on the back and Mac keycaps are included in the box. Modifiers map correctly in Mac mode.',
          daysAgo: 14,
        },
        {
          body: 'Can I swap in 5-pin switches or only 3-pin?',
          displayName: 'SwitchNerd',
          answer: 'The hot-swap sockets accept both 3-pin and 5-pin MX-style switches.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'usbc-hub',
      title: 'PortHub 8-in-1 USB-C Hub',
      handle: 'porthub-8-in-1-usb-c-hub',
      description:
        '<p>An 8-in-1 USB-C docking hub that turns one port into a full workstation: 4K HDMI at 60Hz, gigabit Ethernet, two USB-A 3.2 ports, a USB-C data port, SD and microSD card readers, and 100W pass-through charging so your laptop keeps powering up while it is docked.</p><p>The aluminum shell doubles as a heat sink to stay cool under load, and the captive braided cable tucks away when not in use. Plug-and-play on macOS, Windows, ChromeOS, and iPad with no drivers.</p>',
      productType: 'Adapter',
      vendor: 'Anker Nexus',
      tags: ['usb-c', 'hub', 'dock', '4k hdmi', 'ethernet'],
      seoTitle: 'PortHub 8-in-1 USB-C Hub — 4K HDMI, Ethernet, 100W PD',
      seoDescription:
        'Aluminum 8-in-1 USB-C hub with 4K60 HDMI, gigabit Ethernet, USB-A/C, SD readers, and 100W pass-through charging. Driverless plug-and-play.',
      categoryKeys: ['peripherals'],
      collectionKeys: ['best-sellers', 'deals'],
      variants: [
        {
          sku: 'HUB-USBC-8N1',
          title: null,
          priceCents: 5999,
          compareAtPriceCents: 7499,
          costCents: 2600,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 50,
              reorderQuantity: 200,
              leadTimeDays: 18,
              movements: [
                { delta: 260, reason: 'receive', daysAgo: 24 },
                { delta: -55, reason: 'sale', daysAgo: 12 },
                { delta: -34, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'One cable to rule the desk',
          body: 'Drives my external 4K monitor at 60Hz, charges the laptop, and the Ethernet is full gigabit. Replaced three dongles with this one hub.',
          authorPersona: 'jordan',
          helpfulCount: 9,
          daysAgo: 16,
        },
        {
          rating: 4,
          title: 'Runs a little warm but fine',
          body: 'Gets warm when charging and pushing a display at the same time, but never hot enough to worry. Works great with my iPad too.',
          authorPersona: 'sophia',
          helpfulCount: 4,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'Does the HDMI do 4K at 60Hz or only 30Hz?',
          authorPersona: 'noah',
          answer:
            'Full 4K at 60Hz over HDMI 2.0. If you only see 30Hz, set the refresh rate manually in your display settings.',
          daysAgo: 11,
        },
      ],
    },
    {
      key: 'webcam-4k',
      title: 'ClearView 4K Webcam',
      handle: 'clearview-4k-webcam',
      description:
        '<p>A 4K Ultra HD webcam with a Sony sensor, autofocus, and HDR that holds your face evenly lit even with a bright window behind you. AI auto-framing keeps you centered as you move, and the dual noise-cancelling microphones cut keyboard clatter on calls.</p><p>Streams 4K at 30fps or smooth 1080p at 60fps, with a privacy shutter that physically covers the lens. The universal clip grips laptops and monitors, and a tripod thread underneath lets you mount it however you like.</p>',
      productType: 'Webcam',
      vendor: 'Logitek Vision',
      tags: ['webcam', '4k', 'autofocus', 'streaming', 'work from home'],
      seoTitle: 'ClearView 4K Webcam — HDR, Autofocus, Privacy Shutter',
      seoDescription:
        '4K Ultra HD webcam with Sony sensor, HDR, AI auto-framing, dual noise-cancelling mics, and a physical privacy shutter. 4K30 or 1080p60.',
      categoryKeys: ['peripherals'],
      collectionKeys: ['new-arrivals'],
      variants: [
        {
          sku: 'CAM-CLEAR-4K',
          title: null,
          priceCents: 9999,
          costCents: 4300,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 18,
              movements: [
                { delta: 120, reason: 'receive', daysAgo: 22 },
                { delta: -18, reason: 'sale', daysAgo: 10 },
                { delta: -11, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Finally look good on video calls',
          body: 'The HDR handles my backlit window perfectly — no more silhouette. Auto-framing keeps me centered when I lean back. Huge upgrade from the laptop cam.',
          authorPersona: 'aisha',
          response:
            'Love hearing it, Aisha — that backlight handling is the feature we are proudest of.',
          helpfulCount: 8,
          daysAgo: 13,
        },
        {
          rating: 4,
          title: 'Sharp image, mic is just okay',
          body: 'Video quality is genuinely 4K-sharp. The built-in mics are fine for meetings but I still prefer a headset for podcasts.',
          authorPersona: 'devin',
          helpfulCount: 3,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Does the 4K work in Zoom or is it capped at 1080p?',
          displayName: 'RemoteRita',
          answer:
            'Zoom currently caps webcam input at 1080p, so you will see crisp 1080p there. Full 4K shows up in OBS, recording apps, and Google Meet.',
          daysAgo: 9,
        },
      ],
    },
    {
      key: 'ssd-vault',
      title: 'Vault Portable SSD',
      handle: 'vault-portable-ssd',
      description:
        '<p>A pocket-sized portable SSD that sustains up to 1,050 MB/s read and 1,000 MB/s write over USB 3.2 Gen 2 — fast enough to edit 4K video straight off the drive. The shock-resistant silicone bumper and IP55 dust-and-water rating let it survive a drop or a rainy commute.</p><p>Hardware AES-256 encryption keeps your files locked if it goes missing, and it ships pre-formatted to work with both Mac and Windows out of the box. Both USB-C and USB-A cables are in the box.</p>',
      productType: 'External Drive',
      vendor: 'Crucial Edge',
      tags: ['ssd', 'storage', 'portable', 'usb-c', 'encrypted'],
      seoTitle: 'Vault Portable SSD — 1,050 MB/s, IP55, Hardware Encrypted',
      seoDescription:
        'Pocket portable SSD up to 1,050 MB/s over USB 3.2 Gen 2, IP55 rated with AES-256 hardware encryption. Available in 1TB and 2TB.',
      categoryKeys: ['storage'],
      collectionKeys: ['best-sellers'],
      options: [
        {
          name: 'Capacity',
          displayType: 'segmented',
          values: [{ value: '1TB' }, { value: '2TB' }],
        },
      ],
      variants: [
        {
          sku: 'SSD-VLT-1TB',
          title: '1TB',
          priceCents: 8999,
          costCents: 4200,
          optionValues: ['1TB'],
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 18,
              movements: [
                { delta: 150, reason: 'receive', daysAgo: 27 },
                { delta: -33, reason: 'sale', daysAgo: 12 },
                { delta: -19, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
        {
          sku: 'SSD-VLT-2TB',
          title: '2TB',
          priceCents: 15999,
          costCents: 7900,
          optionValues: ['2TB'],
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 20,
              reorderQuantity: 80,
              leadTimeDays: 18,
              movements: [
                { delta: 90, reason: 'receive', daysAgo: 27 },
                { delta: -21, reason: 'sale', daysAgo: 8 },
                { delta: -10, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Edits 4K straight off the drive',
          body: 'I cut footage directly from the 2TB without copying to the internal SSD first and it never stutters. Tiny enough to live in my camera bag.',
          authorPersona: 'sophia',
          helpfulCount: 7,
          daysAgo: 15,
        },
        {
          rating: 5,
          title: 'Fast and reassuringly tough',
          body: 'Speeds match the spec on my benchmark. Dropped it off a desk onto tile and it did not skip a beat.',
          authorPersona: 'mei',
          helpfulCount: 4,
          daysAgo: 8,
        },
        {
          rating: 3,
          title: 'Cable is a bit short',
          body: 'Drive is great, the included cable is just shorter than I would like. Works perfectly with my own longer USB-C cable.',
          displayName: 'CableHoarder',
          status: 'pending',
          helpfulCount: 1,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Do I have to reformat it to use on a Mac, and does that break the encryption?',
          authorPersona: 'aisha',
          answer:
            'It ships in exFAT so it works on Mac and Windows immediately. The hardware encryption is independent of the file system, so reformatting does not affect it.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'smart-bulb-luma',
      title: 'Luma Smart LED Bulb',
      handle: 'luma-smart-led-bulb',
      description:
        '<p>A Wi-Fi smart LED bulb with 16 million colors and tunable white from a warm 2700K to a crisp 6500K, dimmable down to 1% for movie nights. No hub required — it connects straight to your 2.4GHz network and pairs with the major voice assistants for hands-free control.</p><p>Standard A19 shape and E26 base drop into any lamp or fixture. Schedules, scenes, and sunrise wake-up routines run on the bulb itself, so they fire even if your phone is off the network.</p>',
      productType: 'Smart Lighting',
      vendor: 'Glowtide',
      tags: ['smart home', 'led', 'bulb', 'wifi', 'color'],
      seoTitle: 'Luma Smart LED Bulb — 16M Colors, Tunable White, No Hub',
      seoDescription:
        'Wi-Fi A19 smart bulb with 16 million colors, tunable white 2700K–6500K, 1% dimming, and voice control. No hub required.',
      categoryKeys: ['smart-home'],
      collectionKeys: ['deals'],
      variants: [
        {
          sku: 'BULB-LUMA-A19',
          title: null,
          priceCents: 1799,
          compareAtPriceCents: 2499,
          costCents: 700,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 60,
              reorderQuantity: 240,
              leadTimeDays: 18,
              // Sold out: a popular deal item that net to zero after a big sale.
              movements: [
                { delta: 240, reason: 'receive', daysAgo: 23 },
                { delta: -150, reason: 'sale', daysAgo: 9 },
                { delta: -90, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Sunrise alarm changed my mornings',
          body: 'Set it to fade up over 20 minutes before my alarm and waking up is so much gentler. Colors are vivid and the warm white is genuinely cozy.',
          authorPersona: 'noah',
          response: 'That sunrise routine is a favorite of ours too — thanks Noah!',
          helpfulCount: 6,
          daysAgo: 14,
        },
        {
          rating: 4,
          title: 'Great bulb, app wants an account',
          body: 'Setup was painless and it found my Wi-Fi right away. Only nit is you have to make an account to use the app, but voice control works great after.',
          authorPersona: 'jordan',
          helpfulCount: 3,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Will this connect to 5GHz Wi-Fi or only 2.4GHz?',
          displayName: 'MeshNetworker',
          answer:
            'It uses 2.4GHz only, which is standard for smart bulbs for range. If your router broadcasts one combined name, put your phone on 2.4GHz during setup.',
          daysAgo: 10,
        },
        {
          body: 'Does it keep my schedules if the internet goes down?',
          authorPersona: 'sophia',
          status: 'pending',
          daysAgo: 3,
        },
      ],
    },
    {
      key: 'power-bank-20k',
      title: 'ChargeCore 20K Power Bank',
      handle: 'chargecore-20k-power-bank',
      description:
        '<p>A 20,000mAh power bank that pushes 65W out of its USB-C port — enough to fast-charge most laptops, not just phones. Two extra ports let you top up three devices at once, and the built-in digital display shows exactly how much charge is left so you are never guessing.</p><p>It recharges itself at 45W, going from empty to full in about an hour and a half. The grippy matte shell and rounded edges make it easy to slip in a bag, and pass-through charging means you can power a device while the bank itself is plugged in.</p>',
      productType: 'Power Bank',
      vendor: 'Anker Nexus',
      tags: ['power bank', 'charging', 'usb-c', '65w', 'portable'],
      hazmatClass: 'class9',
      seoTitle: 'ChargeCore 20K Power Bank — 65W USB-C, Digital Display',
      seoDescription:
        '20,000mAh power bank with 65W USB-C output to fast-charge laptops, three-device charging, a digital readout, and 45W recharge.',
      categoryKeys: ['power'],
      collectionKeys: ['best-sellers'],
      variants: [
        {
          sku: 'PWR-CHG-20K',
          title: null,
          priceCents: 4999,
          costCents: 2100,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 18,
              movements: [
                { delta: 180, reason: 'receive', daysAgo: 25 },
                { delta: -36, reason: 'sale', daysAgo: 11 },
                { delta: -24, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Charges my laptop on the road',
          body: 'The 65W output actually keeps my laptop topped up during long flights. The little screen showing exact percentage is more useful than I expected.',
          authorPersona: 'devin',
          helpfulCount: 10,
          daysAgo: 18,
        },
        {
          rating: 4,
          title: 'Heavy but worth it',
          body: 'It has real heft — this is a laptop bank, not a slim phone topper. For the capacity and speed I am happy to carry it.',
          authorPersona: 'aisha',
          helpfulCount: 5,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'Is this allowed in carry-on luggage on a plane?',
          authorPersona: 'mei',
          answer:
            'Yes. At 20,000mAh (about 74Wh) it is under the 100Wh airline limit, so it is fine in carry-on. Power banks are not allowed in checked bags.',
          daysAgo: 13,
        },
      ],
    },
    {
      key: 'laptop-stand',
      title: 'RiseDesk Aluminum Laptop Stand',
      handle: 'risedesk-aluminum-laptop-stand',
      description:
        '<p>A folding aluminum laptop stand that lifts your screen to eye level to take the strain off your neck and shoulders. The open-back design channels airflow under the laptop so it runs cooler and quieter, and silicone pads grip both the desk and your laptop so nothing slides.</p><p>It adjusts through several height and angle stops, then folds flat to the size of a paperback for travel. Rated to hold laptops up to 17 inches and supports tablets too.</p>',
      productType: 'Stand',
      vendor: 'ElevateGear',
      tags: ['laptop stand', 'ergonomic', 'aluminum', 'work from home'],
      seoTitle: 'RiseDesk Aluminum Laptop Stand — Folding, Adjustable',
      seoDescription:
        'Folding aluminum laptop stand that raises your screen to eye level with airflow cooling. Adjustable height, holds laptops up to 17 inches.',
      categoryKeys: ['peripherals'],
      collectionKeys: ['new-arrivals', 'deals'],
      variants: [
        {
          sku: 'STAND-RISE-ALU',
          title: null,
          priceCents: 3499,
          compareAtPriceCents: 3999,
          costCents: 1400,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 18,
              movements: [
                { delta: 140, reason: 'receive', daysAgo: 21 },
                { delta: -25, reason: 'sale', daysAgo: 10 },
                { delta: -13, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My neck thanks me',
          body: 'Within a week the end-of-day neck ache was gone. Rock solid even when I type hard, and it folds down to nothing for trips.',
          authorPersona: 'aisha',
          helpfulCount: 6,
          daysAgo: 12,
        },
        {
          rating: 4,
          title: 'Sturdy, wish it went higher',
          body: 'Build quality is excellent and it does not wobble. I am tall, so I added a small riser under it, but for most people the top height is plenty.',
          displayName: 'StandingDeskFan',
          helpfulCount: 2,
          daysAgo: 5,
        },
      ],
      questions: [
        {
          body: 'Will my 16-inch laptop fit, and is it stable when I use the touchscreen?',
          authorPersona: 'jordan',
          answer:
            'A 16-inch fits comfortably within the 17-inch rating. The rubber feet and wide base keep it steady even with firm touchscreen taps.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'speaker-boom',
      title: 'BoomMini Bluetooth Speaker',
      handle: 'boommini-bluetooth-speaker',
      description:
        '<p>A palm-sized Bluetooth speaker that punches well above its size thanks to a passive bass radiator and an upward-firing driver. IP67 dust and waterproofing means it survives the pool, the shower, and the trail — it even floats if it goes overboard.</p><p>Twelve hours of playback per charge over Bluetooth 5.3, with a built-in mic for speakerphone calls. Pair two together for true stereo, and clip it to a bag with the included carabiner loop.</p>',
      productType: 'Speaker',
      vendor: 'Soundwave',
      tags: ['speaker', 'bluetooth', 'waterproof', 'portable', 'audio'],
      seoTitle: 'BoomMini Bluetooth Speaker — IP67 Waterproof, 12hr',
      seoDescription:
        'Palm-sized Bluetooth 5.3 speaker with passive bass radiator, IP67 waterproofing, 12-hour battery, and true wireless stereo pairing.',
      categoryKeys: ['audio'],
      collectionKeys: ['new-arrivals', 'deals'],
      variants: [
        {
          sku: 'SPK-BOOM-MINI',
          title: null,
          priceCents: 3999,
          compareAtPriceCents: 4999,
          costCents: 1700,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 35,
              reorderQuantity: 140,
              leadTimeDays: 18,
              movements: [
                { delta: 160, reason: 'receive', daysAgo: 20 },
                { delta: -30, reason: 'sale', daysAgo: 9 },
                { delta: -17, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Tiny speaker, big sound',
          body: 'Took it camping and it filled the whole campsite. The bass is genuinely surprising for the size, and it shrugged off a rainstorm.',
          authorPersona: 'noah',
          helpfulCount: 5,
          daysAgo: 11,
        },
        {
          rating: 4,
          title: 'Great for the shower',
          body: 'Lives in my bathroom now and the IP67 rating is no joke. Bass gets a little muddy at max volume but at normal levels it sounds clean.',
          authorPersona: 'sophia',
          helpfulCount: 2,
          daysAgo: 5,
        },
      ],
      questions: [
        {
          body: 'Can I pair two of them for stereo sound?',
          displayName: 'BeachDayBrian',
          answer:
            'Yes — hold the pairing button on both and they link as a left/right stereo pair. They need to be the same model.',
          daysAgo: 7,
        },
      ],
    },
    {
      key: 'wfh-kit',
      title: 'Work-From-Home Starter Kit',
      handle: 'work-from-home-starter-kit',
      description:
        '<p>Everything you need to turn any room into a real home office, bundled and discounted: the ClearView 4K webcam so you look sharp on every call, the Aero TKL mechanical keyboard for all-day typing comfort, and the PortHub 8-in-1 USB-C hub to wire it all into a single laptop port.</p><p>Buy the kit and save versus picking each piece on its own — one box, one click, a finished desk.</p>',
      productType: 'Kits',
      vendor: 'Shop Kit',
      tags: ['kit', 'work from home', 'bundle', 'desk setup'],
      categoryKeys: ['peripherals'],
      collectionKeys: ['best-sellers'],
      variants: [{ sku: 'KIT-WFH-START', title: null, priceCents: 23999, costCents: 12700 }],
      reviews: [
        {
          rating: 5,
          title: 'Whole desk sorted in one order',
          body: 'Set up a home office for a new job in an afternoon. Everything matched, nothing missing, and the bundle price beat buying separately.',
          authorPersona: 'aisha',
          helpfulCount: 5,
          daysAgo: 9,
        },
      ],
      questions: [],
    },
    {
      key: 'mouse-raptor',
      title: 'Raptor Wireless Gaming Mouse',
      handle: 'raptor-wireless-gaming-mouse',
      description:
        '<p>A lightweight 58-gram wireless gaming mouse with a 26,000 DPI optical sensor and a 1,000Hz polling rate over its low-latency 2.4GHz dongle — wired-fast response with none of the cable drag. Optical switches rated for 70 million clicks remove the double-click failures that kill mechanical switches.</p><p>PTFE feet glide effortlessly, six programmable buttons map to whatever you need, and a single charge lasts up to 90 hours. Top up over USB-C or play wired while it charges.</p>',
      productType: 'Mouse',
      vendor: 'Razer Apex',
      tags: ['mouse', 'gaming', 'wireless', 'lightweight', 'peripherals'],
      seoTitle: 'Raptor Wireless Gaming Mouse — 58g, 26K DPI, 90hr',
      seoDescription:
        '58-gram wireless gaming mouse with a 26,000 DPI sensor, 1,000Hz polling, optical switches, and up to 90 hours of battery. USB-C charging.',
      categoryKeys: ['peripherals'],
      collectionKeys: ['new-arrivals'],
      variants: [
        {
          sku: 'MSE-RAPTOR-WL',
          title: null,
          priceCents: 7999,
          costCents: 3400,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 25,
              reorderQuantity: 100,
              leadTimeDays: 18,
              movements: [
                { delta: 110, reason: 'receive', daysAgo: 19 },
                { delta: -20, reason: 'sale', daysAgo: 8 },
                { delta: -12, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Feather-light and flawless',
          body: 'Coming from a 90g mouse this feels like nothing. No latency I can detect on the dongle, and the optical switches feel crisp.',
          authorPersona: 'devin',
          helpfulCount: 8,
          daysAgo: 14,
        },
        {
          rating: 4,
          title: 'Excellent for FPS, a touch small',
          body: 'Tracking is perfect and the battery lasts forever. If you have large hands and palm-grip, try it first — it suits a claw grip best.',
          displayName: 'HeadshotHenry',
          helpfulCount: 3,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Can I use it wired if the battery dies mid-game?',
          authorPersona: 'noah',
          answer:
            'Yes — plug in the USB-C cable and it switches to wired mode instantly while it charges. No interruption to your session.',
          daysAgo: 9,
        },
      ],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'wfh-kit',
      pricing: { mode: 'percent', percentOff: 15 },
      inventoryMode: 'components',
      components: [
        { productKey: 'webcam-4k', quantity: 1, required: true },
        { productKey: 'keyboard-aero', quantity: 1, required: true },
        { productKey: 'usbc-hub', quantity: 1, required: true },
      ],
    },
  ],

  configurator: {
    productKey: 'keyboard-aero',
    name: 'Build your custom keyboard',
    options: [
      {
        key: 'switch-type',
        label: 'Switch type',
        inputType: 'single',
        choices: [
          { value: 'red', label: 'Red (linear)', isDefault: true },
          { value: 'brown', label: 'Brown (tactile)' },
          { value: 'blue', label: 'Blue (clicky)' },
        ],
      },
      {
        key: 'keycap-color',
        label: 'Keycap color',
        inputType: 'swatch',
        choices: [
          { value: 'charcoal', label: 'Charcoal', swatchHex: '#2B2B2F', isDefault: true },
          { value: 'sand', label: 'Sand', swatchHex: '#D9CBB2' },
          { value: 'mint', label: 'Mint', swatchHex: '#9FD3C0' },
        ],
      },
      {
        key: 'layout',
        label: 'Layout',
        inputType: 'single',
        choices: [
          { value: 'tkl', label: 'Tenkeyless (87 keys)', isDefault: true },
          { value: 'full', label: 'Full size (104 keys)', priceDeltaCents: 1500 },
        ],
      },
    ],
    addOns: [{ variantKey: 'HUB-USBC-8N1', defaultIncluded: false, priceOverrideCents: 4999 }],
  },

  articles: [
    {
      slug: 'mechanical-vs-membrane-keyboards',
      title: 'Mechanical vs. membrane keyboards: which should you buy?',
      excerpt:
        'They look similar and one costs three times as much. Here is what you actually get for the money — and who should skip it.',
      daysAgo: 6,
      body: doc(
        p(
          'A membrane keyboard came with your computer; a mechanical keyboard is the one enthusiasts swear by. The difference is real, but it is not magic — it comes down to how each key registers a press.'
        ),
        h2('How they differ'),
        p(
          'A membrane keyboard presses a rubber dome onto a circuit, which feels mushy and gives no clear feedback. A mechanical keyboard puts a discrete spring-loaded switch under every key, so each press is crisp, consistent, and registers at a precise point.'
        ),
        h2('When mechanical is worth it'),
        ul(
          'You type for hours a day and want less finger fatigue',
          'You want to feel exactly when a key actuates, without bottoming out',
          'You care how it sounds, or want to swap switches and keycaps later',
          'You game and want fast, reliable, repeatable key presses'
        ),
        h2('When membrane is fine'),
        ul(
          'You type lightly and mostly browse',
          'You want the quietest possible board for a shared space',
          'Budget is the deciding factor and feel is not a priority'
        ),
        h2('Picking a switch'),
        p(
          'If you go mechanical, the switch decides the feel. Linear switches (often red) are smooth and quiet — great for gaming and shared offices. Tactile switches (brown) give a small bump when the key registers, a nice middle ground for typing. Clicky switches (blue) add an audible click that typists love and officemates do not.'
        )
      ),
    },
    {
      slug: 'how-to-choose-an-ssd',
      title: 'How to choose an SSD: capacity, speed, and the specs that matter',
      excerpt:
        'Internal or portable, SATA or NVMe, 1TB or 2TB — a plain-language guide to buying the right drive without overpaying.',
      daysAgo: 13,
      body: doc(
        p(
          'Solid-state drives are faster, tougher, and quieter than the spinning hard drives they replaced. But the spec sheets are full of acronyms, so here is how to cut through them and buy the right drive.'
        ),
        h2('Internal or portable?'),
        p(
          'An internal SSD upgrades the storage inside a computer. A portable SSD plugs into a USB port to carry files between machines, back up photos and video, or expand a laptop without opening it. If you want to edit footage or move large projects between devices, get a portable drive.'
        ),
        h2('How much capacity do you need?'),
        ol(
          'For documents, a few games, and photos: 1TB is comfortable for most people',
          'For 4K video editing, large game libraries, or a working archive: 2TB or more',
          'Buy one size up from what you think you need — files only grow, and a drive runs best with some free space'
        ),
        h2('Reading the speed numbers'),
        p(
          'Speeds are quoted in MB/s for sequential reads and writes — how fast big files move. For a portable drive over USB 3.2 Gen 2, around 1,000 MB/s is excellent and saturates the connection. Headline speeds higher than that need a faster port (USB4 or Thunderbolt) to actually deliver.'
        ),
        h2('Do not forget durability and encryption'),
        ul(
          'A shock-resistant bumper and a water/dust rating matter if the drive travels',
          'Hardware encryption protects your files if the drive is lost or stolen',
          'Check that it ships ready for your OS, or that reformatting is simple'
        )
      ),
    },
    {
      slug: 'setting-up-a-clean-desk',
      title: 'Setting up a clean, ergonomic desk for working from home',
      excerpt:
        'A tidy, comfortable workspace is mostly a handful of cheap decisions. Here is the order to make them in.',
      daysAgo: 21,
      body: doc(
        p(
          'A good desk setup is not about expensive furniture — it is about getting a few things right so you are comfortable for eight hours and your space stays uncluttered. Work through it in this order.'
        ),
        h2('Get the screen to eye level'),
        p(
          'The single biggest comfort win is raising your screen so the top of it sits at or just below eye level. A laptop stand does this instantly and stops the neck-craning slouch that ends the day with a sore back. Pair it with an external keyboard and mouse so your hands can stay relaxed.'
        ),
        h2('Tame the cables'),
        ol(
          'Replace a pile of dongles with a single USB-C hub so one cable docks the laptop',
          'Route cables along the back edge of the desk and clip them down',
          'Keep only what you touch daily on the surface; everything else goes in a drawer'
        ),
        h2('Fix your camera and light'),
        p(
          'Put a real webcam at eye level rather than looking up your nose from the laptop, and sit facing a window or a lamp instead of having the light behind you. The difference on calls is dramatic and costs almost nothing.'
        ),
        h2('A starter shopping list'),
        ul(
          'A laptop stand to lift the screen',
          'An external keyboard and mouse',
          'A USB-C hub to cut cable clutter',
          'A webcam at eye level with light in front of you',
          'A power bank so a dead battery never ends a coffee-shop session'
        )
      ),
    },
  ],
};
