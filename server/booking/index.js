// index.js — the integration layer. One call gathers normalized options from
// every booking partner so the decision engine sees a single field of options.
import { duffel, kayak, phptravels } from "./adapters.js";

export function gatherOptions(intent) {
  return {
    flights: duffel(intent),
    stays: kayak(intent),
    activities: phptravels(intent),
  };
}
