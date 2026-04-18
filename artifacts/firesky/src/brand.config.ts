/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                  BRAND CONFIGURATION                        ║
 * ║                                                              ║
 * ║  When cloning this project for a new client, this is the     ║
 * ║  ONLY file you need to edit in the frontend.                 ║
 * ║                                                              ║
 * ║  Also update:                                                ║
 * ║    - /public/logo.png           → client logo               ║
 * ║    - /public/splash.png         → auth background image     ║
 * ║    - index.html                 → <title> and apple-meta     ║
 * ║    - artifacts/api-server/src/brand.config.ts               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/**
 * © Leon Mouton – Firesky Industries 2024. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software is strictly prohibited without prior written permission.
 */
export const brand = {
  /** Full legal / trading name */
  name: "Firesky Industries",

  /** Short name used in headings and tight spaces */
  shortName: "Firesky",

  /** Tagline shown on the auth screen */
  tagline: "Your Complete Water Storage Solution",

  /** App title shown in Clerk auth modal header */
  appTitle: "Field Ops Manager",

  /** Primary brand colour — used in Clerk appearance, CSS var override, buttons */
  primaryColor: "#E85D04",
  primaryHover:  "#d45200",

  /**
   * Asset filenames — these files must live in /public
   * Replace with the client's logo and splash image.
   */
  logoFile:   "firesky-logo.png",
  splashFile: "firesky-splash.png",

  /** Contact details */
  contact: {
    email:   "info@fireskyindustries.co.za",
    website: "fireskyops.tech",
    phone:   "",
  },

  /**
   * Industry / product language.
   * Change these when the client sells something other than tanks.
   * e.g. solar panels, boreholes, irrigation systems, generators
   */
  product: {
    singular:      "tank",
    plural:        "tanks",
    sizeLabel:     "Tank Size",
    quantityLabel: "Tank Quantity",
  },

  /** Sky AI persona shown in the chat panel */
  ai: {
    name:    "Sky",
    tagline: "Ask Sky about tanks, site requirements, or your pipeline",
  },

  /** Legal ownership */
  owner: "Leon Mouton",
  copyrightYear: 2024,

  /** Footer credit line in the sidebar */
  credits: "Designed & implemented by Leon Mouton — Firesky Industries",

  /** Pre-filled WhatsApp message templates */
  whatsapp: {
    customerGreeting: (name?: string) =>
      `Hi${name ? ` ${name}` : ""}, this is Firesky Industries reaching out regarding your account.`,
    quoteReady: (name: string | undefined, link: string) =>
      `Hi${name ? ` ${name}` : ""}, your quote from Firesky Industries is ready. View and accept it here: ${link}`,
  },
} as const;
