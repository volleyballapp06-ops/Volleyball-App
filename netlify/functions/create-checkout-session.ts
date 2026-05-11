import { Handler } from "@netlify/functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock");

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { tournamentName, tournamentId, amount } = JSON.parse(event.body || "{}");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `Tournament Posting: ${tournamentName}`,
            },
            unit_amount: amount || 29900,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Note: req.headers.origin might not work the same way in functions
      // We might need to pass the client URL or use a default
      success_url: `${event.headers.origin || "http://localhost:3000"}/tournaments?success=true&session_id={CHECKOUT_SESSION_ID}&tournament_id=${tournamentId}`,
      cancel_url: `${event.headers.origin || "http://localhost:3000"}/tournaments?canceled=true`,
      client_reference_id: tournamentId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error: any) {
    console.error("Stripe error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
