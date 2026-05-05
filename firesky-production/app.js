// Phusion Passenger / cPanel Node.js entry point
// This CommonJS wrapper loads the ESM bundle produced by esbuild.
// Passenger sets the PORT environment variable automatically.

"use strict";

if (!process.env.PORT) {
  // Passenger always sets PORT; this is a safety fallback for manual runs
  process.env.PORT = "3000";
}

// NODE_ENV must be production so the server serves the static React apps
process.env.NODE_ENV = "production";

// Dynamically import the ESM bundle
(async () => {
  try {
    await import("./dist/index.mjs");
  } catch (err) {
    console.error("Failed to start Firesky server:", err);
    process.exit(1);
  }
})();
