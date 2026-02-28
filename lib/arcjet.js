import arcjet, { tokenBucket } from "@arcjet/next";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  characteristics: ["userId"], // Track based on Clerk userId
  rules: [
    // Rate limiting for API actions (account creation, receipt scanning, etc.)
    tokenBucket({
      mode: "LIVE",
      refillRate: 10, // 10 tokens
      interval: 3600, // per hour
      capacity: 10, // maximum burst capacity
    }),
  ],
});

export default aj;
