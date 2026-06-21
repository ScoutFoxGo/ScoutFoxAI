// checkout.routes.js — booking carts + checkout, mounted at /api/checkout.
import { Router } from "express";
import { createCartFromPlan, getCart, payCart } from "./cart.js";

const router = Router();

// Create a cart from a plan. body { plan, meta? } -> { id, url, ... }
router.post("/cart", (req, res) => {
  try {
    const { plan, meta } = req.body || {};
    const cart = createCartFromPlan(plan, meta || {});
    res.json({ ...cart, url: `/checkout.html?cart=${cart.id}` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/cart/:id", (req, res) => {
  const cart = getCart(req.params.id);
  if (!cart) return res.status(404).json({ error: "not found" });
  res.json(cart);
});

// Check out (TEST MODE): pay + issue. body { passengers? }
router.post("/cart/:id/pay", async (req, res) => {
  try {
    res.json(await payCart(req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
