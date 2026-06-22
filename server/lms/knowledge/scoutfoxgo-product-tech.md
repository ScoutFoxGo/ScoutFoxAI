# ScoutFoxGo — Product & Technology

## Product status
Web app and mobile app in development. The product focuses on **recommendations and
decision support** rather than a traditional chat interface. Founder-funded to date
(~$20,000 into web app development, product strategy, branding, research, UX, and AI
concept development). Next phase: get the web app fully live, run a beta with real
families, gather feedback, improve, and prepare for mobile.

## What the backend does
The backend is the engine behind the app. It is responsible for:
- User sign-in and account management
- Family profiles and saved preferences
- Activity and destination listings
- Search, filtering, and recommendations
- **AI-powered matching** based on location, interests, budget, time, and family needs
- Admin controls for managing listings and reviewing activity
- Feedback collection and beta-testing data
- Privacy and security protections
- A future connection to the mobile app

**Key principle:** build the backend **once** so it supports both the web app and
the future mobile app — don't rebuild later.

## AI approach
Decision intelligence over a family/preference profile: behavior tracking and
dynamic context optimization tune recommendations to each user. The platform's
documented model approach uses a fast model for categorization/speed and a stronger
model for deeper reasoning. (The ScoutFoxAI backend generalizes this through one
swappable provider seam, so the AI layer is vendor-independent.)

## Suggested technology stack (from the partner overview)
- **Frontend:** React or Next.js
- **Backend/API:** Node.js or Python/FastAPI (Supabase/Firebase options)
- **Database:** PostgreSQL (Amazon RDS with pgvector noted for vector search)
- **Auth:** Supabase/Firebase/Auth0 (Google + Apple sign-in)
- **Hosting:** Vercel, Render, AWS, or Google Cloud
- **AI layer:** provider API for smart recommendations + planning assistance
- **Maps/location:** Google Maps API or Mapbox
- **Weather:** OpenWeather or similar (weather-aware suggestions)
- **Payments:** Stripe (premium memberships / partner payments)
- **Analytics:** Google Analytics, PostHog, or Mixpanel
- **Admin:** Retool, Supabase Studio, or a custom dashboard
