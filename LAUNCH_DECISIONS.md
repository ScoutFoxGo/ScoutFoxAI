# Scout Fox Go™ — Launch Decisions

Source of truth for the 82-question launch master list. Each answer is tagged:

- **[decided]** — already settled by what's built in this repo (cite the module).
- **[rec]** — engineering recommendation; confirm or override.
- **[your call]** — a business / brand / legal decision that's yours to make.

> This file is also ingested into the closed LMS corpus (`npm run seed:knowledge`
> in `server/`) so Scout can answer team questions about the product itself.

---

## Section 1 — Product Strategy & Business Model
1. **Core launch features** — [rec] Trip planner (trips/trip_days), Scout Guide (RAG tutor), FamilyCompass recommendations, Mood AI itinerary adaptation, Scout Scribe trip reports, Smart Cards, saved places, packing lists.
2. **Later phases (V2/V3)** — [rec] Scout Pay, full Scout Points economy, family collaboration/real-time co-editing, i18n beyond ES/FR, VR/AR + 3D avatar (Addendum 2.13, explicitly Phase 3).
3. **App Store category** — [rec] **Travel** (primary); Lifestyle as secondary.
4. **Public modules at launch** — [your call] Recommend: Guide, Compass, Trip planner, Scribe, Smart Cards. Keep Pay/Points internal until V2.
5. **Sub-brand logos/colors/icons** — [your call] Recommend one shared identity at launch; sub-brand later.
6. **One Scout Hub vs separate** — [rec] One hub (your Dashboard "Adventure Toolkit" already does this).
7. **Subscription tiers** — [your call] Recommend Free / Pro / Family.
8. **Features per tier** — [your call] Suggest: Free = limited AI credits + core planner; Pro = Advanced model tier + unlimited Guide; Family = multi-profile + collaboration.
9. **Referral discounts / Scout Points bonuses** — [your call] Recommend yes (referral tracking is Addendum 2.14).
10. **Free tier / trial / credits** — [decided/rec] Credit-based AI usage — your `FreemiumUsageTracker` + per-user throttling already fit.
11. **Soft launch / beta** — [your call] Recommend a waitlist beta (waitlist_signups already modeled).
12. **Launch date** — [your call].
13. **Marketing channels** — [your call].
14. **Waitlist landing page** — [rec] Yes; data shape exists (`waitlist_signups`).

## Section 2 — AI System Design
15. **Scout's personality** — [your call] Recommend: warm, encouraging family sidekick; concise.
16. **Topics to avoid** — [rec] Medical/legal advice, anything unsafe for kids; defer to disclaimers (Q44–46).
17. **Empathetic vs efficient** — [rec] Empathetic-but-brief; lead with the answer.
18. **Proactive alerts** — [rec] Yes via Smart Cards + notifications (2.3/2.15).
19. **Auto-recommend spots** — [decided] FamilyCompass + Mood AI.
20. **Daily Scout Cards** — [decided] Smart Cards engine (`/api/scout/cards/generate`).
21. **Personalization depth** — [decided] Family profiles + learner model drive it.
22. **Long-term preference memory** — [decided] LMS learner model + `family_profiles`.
23. **Family profiles influence recs** — [decided] Wired into Mood AI.
24. **Monthly AI cost target** — [your call] + [rec] tiered models (Fast=Sonnet/Haiku, Pro=Opus) to control it.
25. **Throttle usage** — [rec] Yes, per-user credits.
26. **Cache common answers** — [decided] Closed corpus caches/grounds; research distills back in.
27. **RAG documents** — [decided] Safety tips, travel hacks, cultural briefings, seasonal content (Scout Guide categories, Addendum 2.5).
28. **Content creators/approvers** — [your call] Recommend admin-approved ingestion (KB has source/version/tags).
29. **RAG internal vs external** — [decided] **Internal-only by default; research fallback is opt-in** and writes results back into the closed corpus.

## Section 3 — UX, Branding & Content
30. **Mobile/desktop/responsive** — [rec] Mobile-first, responsive (matches the App Store path).
31. **Accessibility** — [your call/rec] High contrast, large text, screen reader, low-cognitive-load mode (Addendum 2.11).
32. **Gamified onboarding** — [your call] Recommend light gamification (ties to Points).
33. **Preloaded destination content** — [rec] Yes; `destinations` seed exists.
34. **Guide includes safety tips + hacks** — [decided] Yes (Scout Guide corpus).
35. **Templates / journals** — [rec] Yes; Scribe + scrapbook cover journaling.
36. **Shared brand palette** — [your call] Recommend yes.
37. **Full brand kit at launch** — [your call].

## Section 4 — Legal, Safety & Compliance
38. **Parental consent flows** — [your call/legal] Required for under-13 (COPPA, Addendum 2.12).
39. **Kids' own profiles** — [rec] Yes (`family_profiles`/kids_info).
40. **Separate kids' data deletion** — [your call/legal] Yes.
41. **Chat retention** — [rec] 30 days default.
42. **Delete chat history** — [rec] Yes, user-controllable.
43. **GDPR export/delete** — [decided/rec] Yes — your `exportUserData`/`deleteAccount` cover the mechanics.
44. **Travel safety disclaimers** — [your call/legal] Yes.
45. **Weather/logistics accuracy warnings** — [your call/legal] Yes.
46. **Third-party data disclaimers** — [your call/legal] Yes.
47. **Refund policy** — [your call/legal].
48. **Auto-renew** — [your call].
49. **Pause membership** — [your call] Recommend yes.

## Section 5 — Tech Infrastructure & Architecture
50. **Hosting** — [decided/rec] **Render** for this AI service (`render.yaml` set up); Base44 hosts the app.
51. **Pinecone vs Qdrant** — [rec] Neither at launch (in-house retrieval). At scale: **Qdrant** (self-hostable, fits "closed") over Pinecone (external SaaS).
52. **S3 vs Cloudinary** — [rec] Cloudinary if you want auto-compress out of the box; S3 for full control.
53. **Users in first 3 months** — [your call].
54. **Photo volume** — [your call].
55. **Auto-compress photos** — [rec] Yes.
56. **Push (Firebase)** — [rec] Yes — note: external service.
57. **SMS (Twilio)** — [rec] Yes — external service.
58. **Automated email** — [rec] Yes — external service. (56–58 are the Notifications module, Addendum 2.3.)

## Section 6 — Features & Module Decisions
59. **AI-driven vs user-guided itinerary** — [decided] Hybrid: user trips + AI mood adaptation.
60. **Real-time route optimization** — [your call] V2.
61. **Multi-destination trips** — [your call] Recommend V2.
62. **Static vs AI packing lists** — [decided/rec] Static defaults (`packing_list_items`) + AI augmentation.
63. **Calendar sync** — [your call] V2.
64. **Time-zone adjustments** — [rec] Yes (trips have dates).
65. **Scribe PDFs include photos** — [rec] Yes (scrapbook photos).
66. **Public album sharing** — [your call] Recommend opt-in only (kid safety).
67. **Narrative Trip Stories** — [decided] Scout Scribe.
68. **Multi-user trip collaboration** — [your call] V2 (Addendum 2.4).
69. **Friends join trips** — [your call] V2.
70. **Shared packing lists** — [your call] V2.

## Section 7 — Admin Panel Decisions
71. **Admin role levels** — [rec] Yes (the Next.js dashboard already assumes roles).
72. **Impersonate users for support** — [your call] Recommend yes, audited.
73. **Admin AI analytics** — [decided] `/api/admin/analytics`, sessions, feedback, traces.
74. **Destination library** — [decided] `destinations` collection + admin tags.
75. **Approve user-created spots** — [rec] Yes, moderation queue.
76. **Destination category tags** — [rec] Yes.

## Section 8 — Post-Launch Operations
77. **Human customer support** — [your call].
78. **Scout handles basic support** — [rec] Yes — closed tutor over a support KB.
79. **Feedback trains future AI** — [decided] Feedback manager + self-learning loop distill good answers into the corpus.
80. **KPIs** — [rec] WAU, trips created, Guide answer rate, % answered in-house vs research, retention, conversion to paid.
81. **Milestone reports** — [rec] Yes (Scribe + learner milestones).
82. **Analytics dashboard** — [decided] Admin analytics module feeds it.
