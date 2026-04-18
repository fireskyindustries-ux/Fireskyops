/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                  BRAND CONFIGURATION — API SERVER           ║
 * ║                                                              ║
 * ║  When cloning this project for a new client, this is the     ║
 * ║  ONLY file you need to edit in the API server.               ║
 * ║                                                              ║
 * ║  Also update:                                                ║
 * ║    - artifacts/firesky/src/brand.config.ts                   ║
 * ║    - artifacts/firesky/index.html  (<title> tag)             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const brand = {
  /** Full legal / trading name */
  name: "Firesky Industries",

  /** Short name used in email subjects and tight spaces */
  shortName: "Firesky",

  /** Tagline used in email footers */
  tagline: "Your Complete Water Storage Solution",

  /** From address for all system emails */
  fromEmail: "Firesky Industries <info@fireskyindustries.co.za>",

  /** Support / reply-to email */
  supportEmail: "info@fireskyindustries.co.za",

  /** Public-facing website / app domain */
  website: "fireskyops.tech",

  /** Primary brand colour (hex) — used in email HTML headers */
  primaryColor: "#E85D04",

  /** Sky AI persona */
  ai: {
    name:        "Sky",
    description: "the digital assistant for Firesky Industries",
    role:        "warm, friendly, and genuinely here to help",
  },

  /**
   * Industry description used in Sky AI system prompts.
   * Change these when the client is in a different industry.
   */
  industry: {
    /** What the business sells / installs */
    product: "water and chemical storage tanks",
    /** Where they operate */
    serviceArea: "homes, farms, and remote rural properties across South Africa",
    /** Unique value proposition */
    uniqueValue: "including locations that others will not service",
    /** Short description of a typical job site */
    siteType: "farm, home, or rural property",
  },

  /** Seed data — name of the default head-office branch created on first run */
  defaultBranchName: "The Factory",
  defaultBranchDescription: "Head office and primary stock warehouse",
} as const;
