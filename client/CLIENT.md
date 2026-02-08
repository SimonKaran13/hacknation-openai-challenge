# Client (Next.js)

This frontend is a Next.js + TypeScript MVP that demonstrates the UI flow for the hackathon demo. It consumes mock data today but is structured for easy API integration.

## Quick Start
```bash
pnpm install
pnpm run dev
```
Open `http://localhost:3000`

## Demo Flow
1. Click `Simulate Meeting Ended`
2. Review the conflict in the Deconfliction Console
3. Click `Resolve`
4. Optionally run `What changed today?`

## Notes
- The current state is local mock data for speed and reliability.
- Components are organized for future API + knowledge graph integration.
- TODO: Wire to live backend endpoints.
