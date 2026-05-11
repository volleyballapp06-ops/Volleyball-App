import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { tournamentName, tournamentId, amount } = req.body;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: `Tournament Posting: ${tournamentName}`,
              },
              unit_amount: amount || 29900, // Default 299 INR
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin}/tournaments?success=true&session_id={CHECKOUT_SESSION_ID}&tournament_id=${tournamentId}`,
        cancel_url: `${req.headers.origin}/tournaments?canceled=true`,
        client_reference_id: tournamentId,
      });

      res.json({ id: session.id });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/verify-session/:sessionId", async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      res.json({ status: session.payment_status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, we assume the server might be running from the dist folder or root
    // If running from dist (compiled), __dirname is dist. If running from root, __dirname is root.
    const isRunningFromDist = __dirname.endsWith("dist");
    const distPath = isRunningFromDist ? __dirname : path.resolve(__dirname, "dist");
    
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
