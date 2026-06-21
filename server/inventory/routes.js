// routes.js — unified inventory search (hotels/cruises/activities) at /api/inventory,
// and Scout Wallet (deals) at /api/wallet.
import { Router } from "express";
import { searchInventory, INVENTORY_TYPES } from "./index.js";
import { getWallet, setMemberships, applyWallet, listPrograms } from "../wallet/wallet.js";

const router = Router();

router.get("/types", (_req, res) => res.json({ types: INVENTORY_TYPES }));

// POST /api/inventory/search  body { type:"hotel|cruise|activity", destination?, ... , userId? }
// If userId is given, the Scout Wallet is applied (deals annotated + prioritized).
router.post("/search", async (req, res) => {
  const { userId, ...params } = req.body || {};
  try {
    const result = await searchInventory(params);
    if (userId) {
      const walleted = applyWallet(userId, result.options);
      return res.json({ ...result, ...walleted });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

// Separate Scout Wallet router.
export const walletRouter = Router();
walletRouter.get("/programs", (_req, res) => res.json({ programs: listPrograms() }));
walletRouter.get("/:userId", (req, res) => res.json(getWallet(req.params.userId)));
walletRouter.post("/:userId", (req, res) => {
  try {
    res.json(setMemberships(req.params.userId, (req.body || {}).memberships));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
walletRouter.post("/:userId/apply", (req, res) => {
  try {
    res.json(applyWallet(req.params.userId, (req.body || {}).options || []));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
