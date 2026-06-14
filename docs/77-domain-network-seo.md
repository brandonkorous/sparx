# Sparx Platform — Domain Network & SEO Strategy

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. The Domain Network

Sparx operates a purposeful network of domains. Each domain has one job and links back to sparx.works. The interlinking network builds topical SEO authority across the entire portfolio.

### Platform Domains

| Domain             | Purpose                                                | Points to       |
| ------------------ | ------------------------------------------------------ | --------------- |
| sparx.works        | Primary brand, marketing site, merchant signup         | —               |
| app.sparx.works    | Merchant dashboard                                     | GKE LB          |
| api.sparx.works    | REST + GraphQL API                                     | GKE LB          |
| mcp.sparx.works    | MCP server                                             | GKE LB          |
| status.sparx.works | Status page                                            | GKE LB          |
| sparx.email        | Postal sending infrastructure + Email module marketing | GKE LB / Postal |

### Merchant Site Domains

| Domain         | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| \*.sparx.zone  | All merchant sites (wildcard, one DNS record)          |
| [merchant].com | Custom merchant domains (CNAME → customers.sparx.zone) |

### Marketplace Domains

| Domain               | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| sparx.market         | Universal product marketplace (all public products) |
| sparx.market/auto    | Automotive category                                 |
| sparx.market/beauty  | Beauty category                                     |
| sparx.market/home    | Home goods category                                 |
| sparx.market/fashion | Fashion category                                    |
| sparx.market/food    | Specialty food category                             |
| sparx.market/tech    | Tech & electronics category                         |
| sparxshops.com       | Alternate marketplace entry point                   |

### Module Marketing Domains

| Domain         | Module           | Accent color  |
| -------------- | ---------------- | ------------- |
| sparxcms.com   | CMS              | Teal #14B8A6  |
| sparxcrm.com   | CRM              | Cyan #06B6D4  |
| sparxemail.com | Email            | Sky #0EA5E9   |
| sparxb2b.com   | B2B/Wholesale    | Slate #475569 |
| sparx.host     | Managed hosting  | —             |
| sparx.software | Developer portal | —             |

### Defensive Domains

| Domain         | Status                               |
| -------------- | ------------------------------------ |
| sparx.exchange | Registered, redirects to sparx.works |

---

## 2. The SEO Interlinking Strategy

Every domain builds authority independently AND passes it to sparx.works:

```
sparx.works          ←→  sparx.market        (mutual links)
sparx.works          ←→  sparxcms.com        (mutual links)
sparx.works          ←→  sparxcrm.com        (mutual links)
sparx.works          ←→  sparxemail.com      (mutual links)
sparx.works          ←→  sparxb2b.com        (mutual links)
sparx.works          ←→  sparx.software      (mutual links)
sparx.works          ←→  sparx.host          (mutual links)

sparx.market/auto    →   sparx.works         (merchant signup CTA)
sparx.market/[cat]   →   sparxcms.com        (content-relevant)
[merchant].sparx.zone →  sparx.works         (powered by Sparx footer)
```

**Key rule:** Every domain must have a real landing page, not a redirect. A real landing page:

- Has indexable content (Google can crawl and rank it)
- Has unique content for that domain's purpose
- Links back to sparx.works
- Has a CTA relevant to that domain's visitor

A 301 redirect passes link equity but loses the indexable page. Real pages build their own authority AND pass equity through the link.

---

## 3. Module Marketing Domain Structure

Each module domain (sparxcms.com, sparxcrm.com, etc.) follows the same structure:

```
sparxcms.com
  /                 → CMS module marketing page
                      "Content management built for commerce"
                      Feature highlights specific to CMS
                      Pricing ($49/mo standalone or with Builder)
                      "Powered by Sparx · Part of sparx.works →"

  /features         → Detailed feature breakdown
  /pricing          → Module pricing + bundle options
  /blog             → CMS-specific content (optional, for SEO)
  /docs             → Links to sparx.software docs
```

Each module site uses its module color as the primary accent (teal for CMS, cyan for CRM, etc.) on top of the shared Sparx neutral palette. The design language is identical — only the accent color and content differ.

All CTAs point to: `sparx.works/signup?module=cms` — the module query param pre-selects the relevant module during onboarding.

---

## 4. sparx.market Category Architecture

Category subpaths are SEO landing pages that exist independent of product count:

```
sparx.market/auto
  /                 → "The automotive marketplace on Sparx"
                      Even with 0 products:
                        - Category description and value prop
                        - Featured merchants in this category
                        - "Are you an auto parts merchant? Join free →"
                        - Links to sparx.works/signup?category=auto

  /products         → All public auto products from all merchants
                      (empty state: "Be the first auto merchant on Sparx")

  /merchants        → Directory of merchants selling auto products
  /blog             → Optional: auto-specific content for long-tail SEO
                      "How to find the right diesel injector for your F-350"
```

**Category launch criteria:** Launch with content, not with product count. A category page with 0 products but good content is better for SEO than a category page with 5 products that's never been indexed.

**Category SEO targets:**

| Category | Primary keywords                                          |
| -------- | --------------------------------------------------------- |
| /auto    | auto parts online, car parts marketplace, diesel parts    |
| /beauty  | independent beauty brands, small business beauty products |
| /home    | handmade home goods, independent home decor               |
| /fashion | independent fashion brands, small business clothing       |
| /food    | specialty food online, artisan food marketplace           |
| /tech    | independent tech accessories, small business electronics  |

---

## 5. sparxshops.com

Alternative entry point to the sparx.market ecosystem. Different brand identity, same underlying product graph:

```
sparxshops.com
  /                 → "Thousands of independent shops. One place."
                      Browse by category
                      Featured shops (merchant profiles)
                      New arrivals across all merchants

  /shops            → Merchant directory (all public Sparx merchants)
  /shops/[slug]     → Individual merchant profile
  /[category]       → Category browse (mirrors sparx.market categories)
```

sparxshops.com targets consumer search intent ("shops", "independent stores") while sparx.market targets product search intent ("buy X online", "X marketplace"). Two surfaces, one product graph, different SEO footprints.

---

## 6. DNS Architecture

All domains managed in Cloudflare. Two zone types:

**Platform zones (orange cloud — Cloudflare proxied):**

- sparx.works, sparxcms.com, sparxcrm.com, sparxemail.com, sparxb2b.com, sparxshops.com, sparx.software, sparx.host, sparx.market

Benefits: DDoS protection, WAF, CDN caching for static content, performance.

**Site zones (grey cloud — DNS only, not proxied):**

- sparx.zone (wildcard), customers.sparx.zone
- NOT proxied because Caddy handles SSL via Let's Encrypt on-demand TLS. Cloudflare proxying interferes with ACME challenges on custom merchant domains.

**Key Cloudflare records:**

```
sparx.works          A     → GKE LB IP
*.sparx.works        A     → GKE LB IP
sparx.zone           A     → GKE LB IP
*.sparx.zone         A     → GKE LB IP (grey cloud)
customers.sparx.zone CNAME → GKE LB hostname (grey cloud)
sparx.market         A     → GKE LB IP
*.sparx.market       A     → GKE LB IP
```

---

## 7. Merchant Custom Domain Flow

When a merchant adds a custom domain:

```
1. Merchant enters "shop.acme.com" in Settings → Domains
2. Platform shows instructions:
   Add this DNS record to your domain registrar:
   Type: CNAME
   Name: shop (or @ for root)
   Value: customers.sparx.zone

3. Domain worker polls every 5 minutes for CNAME propagation
4. On verification:
   → domain.verified Pub/Sub event
   → Caddy on-demand TLS issues Let's Encrypt cert
   → shop.acme.com is live with HTTPS
   → merchant.sparx.zone redirects 301 to custom domain

5. All subsequent visits: cert cached, sub-200ms response
```

---

## 8. "Powered by Sparx" Footer Link

Every merchant site on sparx.zone displays a subtle footer link:

```
Powered by Sparx ↗  (links to sparx.works)
```

This is opt-out on Pro+ plans (merchant can remove it). Default on all plans. This link appears on potentially thousands of merchant sites, building sparx.works domain authority passively at scale.

---

## 9. Implementation Checklist

- [ ] All domains transferred to Cloudflare (or new Cloudflare account)
- [ ] DNS records configured per section 6
- [ ] Orange cloud on platform domains
- [ ] Grey cloud on \*.sparx.zone and customers.sparx.zone
- [ ] sparx.market Next.js app with category routing
- [ ] Category landing pages with content (even at 0 products)
- [ ] Module marketing domains — landing pages
- [ ] sparxshops.com — basic landing page + merchant directory
- [ ] "Powered by Sparx" footer link (opt-out for Pro+)
- [ ] Sitemap.xml for all domains
- [ ] robots.txt for all domains
- [ ] Canonical tags — prevent duplicate content across surfaces
- [ ] Google Search Console setup for all domains
- [ ] Cloudflare Analytics configured
      EOF
