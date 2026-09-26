// Print a fresh access code and the ACCESS_CODES entry to add on Vercel.
// Usage: npm run new-code -- <name>
import crypto from "node:crypto";
const name = (process.argv[2] || "user").replace(/[^\w-]/g, "").toLowerCase();
const code = crypto.randomBytes(9).toString("base64url");
console.log(`Code for ${name}: ${code}`);
console.log(`Append to ACCESS_CODES on Vercel (comma-separated): ${name}:${code}`);
