const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

console.log(`
Manual smoke test for ${API_BASE_URL}

1. Start infrastructure:
   docker compose up -d postgres redis qdrant

2. Run Prisma:
   npm run prisma:generate
   npm run prisma:deploy

3. Start API and worker in separate terminals:
   npm run dev
   npm run worker:dev

4. Health and readiness:
   curl ${API_BASE_URL}/health
   curl ${API_BASE_URL}/ready

5. Create a notebook:
   NOTEBOOK_ID=$(curl -s -X POST -H "Content-Type: application/json" -d '{"title":"Smoke Notebook"}' ${API_BASE_URL}/api/notebooks | jq -r '.data.id')

6. Create a text source:
   SOURCE_ID=$(curl -s -X POST -H "Content-Type: application/json" -d '{"title":"Tiny Notes","type":"TEXT","content":"Retrieval augmented generation combines retrieved source context with model generation."}' ${API_BASE_URL}/api/notebooks/$NOTEBOOK_ID/sources | jq -r '.data.source.id')

7. Poll source status until READY:
   curl ${API_BASE_URL}/api/sources/$SOURCE_ID/status

8. Create a conversation:
   CONVERSATION_ID=$(curl -s -X POST -H "Content-Type: application/json" -d '{"title":"RAG Chat"}' ${API_BASE_URL}/api/notebooks/$NOTEBOOK_ID/conversations | jq -r '.data.id')

9. Ask a grounded question:
   curl -s -X POST -H "Content-Type: application/json" -H "Accept: application/json" -d '{"content":"What does RAG combine?","limit":5}' ${API_BASE_URL}/api/conversations/$CONVERSATION_ID/messages

10. Ask a contextual follow-up:
   curl -s -X POST -H "Content-Type: application/json" -d '{"content":"Explain that simply"}' ${API_BASE_URL}/api/conversations/$CONVERSATION_ID/messages

11. Load message history:
   curl ${API_BASE_URL}/api/conversations/$CONVERSATION_ID/messages?limit=20

12. Rename the conversation:
   curl -X PATCH -H "Content-Type: application/json" -d '{"title":"Redis Notes"}' ${API_BASE_URL}/api/conversations/$CONVERSATION_ID

13. Stream a message:
   curl -N -X POST -H "Content-Type: application/json" -H "Accept: text/event-stream" -d '{"content":"Explain the main concept simply"}' ${API_BASE_URL}/api/conversations/$CONVERSATION_ID/messages

14. Delete source and notebook:
   curl -X DELETE ${API_BASE_URL}/api/sources/$SOURCE_ID
   curl -X DELETE ${API_BASE_URL}/api/notebooks/$NOTEBOOK_ID
`);
