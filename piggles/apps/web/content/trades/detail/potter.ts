import type { TradePage } from '../types';

export const POTTER_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a website you pay for separately from the place you sell',
      instead: 'site',
      why: 'The site and the shop read from the same catalog, so a piece added once is on your pages and for sale at the same moment, with nothing to copy across.',
    },
    {
      today: 'a spreadsheet of what is left after each shop update',
      instead: 'stock',
      why: 'The count moves on its own when a piece sells on your site or at a fair, so keeping track stops being a second job after the first one.',
    },
    {
      today: 'an email thread for every commission',
      instead: 'customers',
      why: 'Each commission is a job on a board with its value and its next step, and the emails you send about it sit on that customer’s record instead of in six separate threads.',
    },
    {
      today: 'posting the same kiln photo to three networks by hand',
      instead: 'get_found',
      why: 'Set standing times, like Friday at 7pm for every update, and fill them ahead. A slot with nothing planned can draw from a pool of posts worth running again rather than going quiet.',
    },
    {
      today: 'a newsletter tool with its own separate subscriber list',
      instead: 'messages',
      why: 'Your list is your buyers, so the people who bought last month are already on it, and anybody who unsubscribes is off it everywhere without you keeping track.',
    },
  ],
  inDepth: [
    {
      app: 'site',
      heading: 'A website that shows the work the way you would hang it.',
      body: 'For a potter the website is the gallery, the shop and the studio door all at once. My Site lets you change it yourself, on the evening you unload the kiln, without phoning anybody.',
      points: [
        'Your colors and type are set once and worn by every page, so changing to a palette that suits the new glazes changes the whole site at once.',
        'The menu and footer are their own piece, so your studio hours or the list of shops that stock you are edited once and right on every page.',
        'A section you repeat, such as a panel on caring for stoneware or a call for commissions, can be saved once and updated everywhere from one place.',
        'Next week’s update can be built as a draft while the live site carries on selling this week’s pieces, and every publish is kept as a version.',
        'Every inquiry sent through your contact form is kept and readable in Piggles, not just an email you might delete by accident.',
        'Every section reflows on a phone, so a gallery still looks right for somebody who tapped through from your Instagram.',
      ],
    },
    {
      app: 'sell',
      heading: 'Take the money, wherever the piece sells.',
      body: 'Your site, a craft fair table and a gallery shop that buys wholesale all end up in the same order list. The money from each sale settles into your own account through the payment provider you already use.',
      points: [
        'A set of four plates can be one product, and a mug with a bag of coffee can be sold together as a bundle at its own price.',
        'Baskets people filled and then left are listed, so a gentle follow-up goes to somebody who was genuinely about to buy that vase.',
        'Wishlists show which pieces people have saved, which is a fair guide to what to make more of before the next firing.',
        'A piece that arrives broken is requested back, inspected, written off and refunded, and the stock count and the money both move once, without a correction afterwards.',
        'Sales by piece, by day and by category are right there, so which glaze actually sells is an answer rather than a hunch.',
        'An early-access code for your mailing list follows rules you can predict, with dates and limits set before the update opens.',
      ],
    },
    {
      app: 'stock',
      heading: 'On the shelf, packed for a fair, or sold. Always one of them.',
      body: 'When everything is a count of one, a small mistake is a whole piece. Stock keeps an honest record of each one, with a trace every time it changes, so a missing bowl is a question with an answer.',
      points: [
        'Every change is logged with a reason and a name: sold, returned, damaged, counted. A cracked bowl is recorded as damaged rather than quietly missing.',
        'Shelves and crates can be labeled, so the studio knows the celadon mug is in the second crate on the left, not just that it exists somewhere.',
        'Your own details on each piece, such as clay body, glaze and firing, are kept on the record and searchable like everything else.',
        'A gift box of a mug, a coaster and a card knows what it is made of, and how many you could put together from what is on hand.',
        'If your studio shop sells another maker’s pieces on consignment, they are kept apart from your own, so what the stock is worth is what you actually own.',
        'Pieces that have not sold since spring show up as not moving, which is a good start on the list for a studio sale.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring your pieces and buyers across',
      body: 'Open Move in and pick the online shop or website builder you are leaving, then drop in the export it makes. Some can be connected with a single read-only key so you skip the exporting. Depending on where you are coming from, products, customers, past orders, pages, posts and images can all come over, and you see exactly what will happen before anything is saved.',
    },
    {
      title: 'Keep your old links working',
      body: 'Bring in the list of your old page addresses and where each one should point now. A link to your old shop that somebody shared two years ago still lands on the right page instead of a dead end.',
    },
    {
      title: 'Add open commissions by hand',
      body: 'Commissions that live in your email do not come across from a file, so add the open ones as jobs yourself. Anything from your export that could not be read is listed with its row number, ready to fix and drop in again.',
    },
  ],
  cost: {
    heading: 'The website, the shop and the announcements, for one price.',
    body: '$99 a month covers your site, selling, stock, email, social posting and every other app, sixteen in all. An update with forty pieces costs the same as one with four.',
    points: [
      'One business, one location, one main website on your own domain with the security certificate included, and three people with their own sign-in.',
      'Pieces, orders and invoices are unlimited, so no count of products ever pushes you onto a bigger plan, because there is only one.',
      '10 GB of storage is included for photos, documents and everything you upload. If your photos outgrow it, add more room in one tap with the price on the button, and remove it the same way.',
      '5,000 emails a month are included for shop-update announcements, and order emails do not count toward them.',
      'Your payment provider charges its own card fees, under your own terms with them. Piggles never sits in the middle of the money.',
      'Fourteen days free with no card. If you do not carry on, nothing is charged.',
    ],
  },
};
