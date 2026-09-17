# EstateLux

Premium U.S. real-estate website starter using the selected second EstateLux logo.

## Included
- Luxury responsive homepage
- Buy / Rent search
- Property type, bedroom and price/rent filters
- Nationwide-ready RentCast integration
- Demo listings so the site works before the API is connected
- Favorites saved in the browser
- Property detail modal
- Google Maps property-location links
- Request Information form
- Sign-in UI
- Saved-search/email-alert UI
- Mobile bottom navigation
- SEO title, description, robots directive
- Privacy and Terms pages
- Vercel serverless API route that keeps the RentCast key off the browser

## Deploy
1. Upload this folder to GitHub.
2. Import the repository into Vercel.
3. In Vercel → Project Settings → Environment Variables, add:
   RENTCAST_API_KEY = your RentCast API key
4. Redeploy.
5. The frontend will call `/api/listings` and use live listings when the API responds.
6. Demo listings remain available if the API is not configured.

## Important
The included demo photos are only for the prototype. Before public launch, use property photos/data according to the applicable API/feed licensing and display terms.

The production version should next connect:
- Supabase Auth + database
- Email provider for property alerts and inquiries
- Admin dashboard
- Real property-image handling
- Google Maps/Mapbox production map
- Analytics and Search Console
- Production Privacy/Terms language
