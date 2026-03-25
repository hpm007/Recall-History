export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const headers = req.headers;
    const userId = headers.get("x-user-id");

    const FREE_LIMIT = 50;
    const PRO_LIMIT = 1000;

    if (typeof userId !== "string" || userId === null) {
      return Response.json({error: "Missing or non-string user id"}, {status: 400});
    }

    // 1️⃣ Route handling FIRST
    if (pathname === "/debug/user") {
      const userId = req.headers.get("x-user-id");
      return Response.json(await getUser(env, userId));
    }
    else if (pathname === "/usage"){
      const usage = await getUsage(env, userId);
      const user = await getUser(env, userId)

      const limit = user?.plan === "pro" ? PRO_LIMIT : FREE_LIMIT;
      return Response.json({usage, limit});
    }
    else if (pathname === "/webhook/paddle") {
      if (req.method !== "POST") {
        return Response.json({error: "Method Not Allowed"}, {status: 405});
      }
      return handlePaddleWebhook(req, env);
    }
    else if (req.method !== "POST") {
      return Response.json({error: "Method Not Allowed"}, { status: 405 });
    }

    const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
    const OPENAI_EMBED_ENDPOINT = "https://api.openai.com/v1/embeddings";

    const body = await req.json();
    const { text, type } = body;


    if (!text || !type) {
      return Response.json({error: "Bad Request"}, { status: 400 });
    }

    let usage = await getUsage(env, userId);
    const user = await getUser(env, userId);

    const isPro = user?.plan === "pro";
    const limit = isPro ? PRO_LIMIT: FREE_LIMIT;

    if (usage >= limit) {
      return Response.json({error: "Usage limit reached", usage, limit}, {status: 402});
    }

    let openaiBody;
    let target_url;

    const system = "You are a concise summarizer. Return a brief summary highlighting main points.";
    const userPrompt = `Summarize the following article in 2-4 concise sentences:\n\n${text}`;

    if (type === "summary") {
      openaiBody = {
        model: "gpt-5-nano",
        reasoning: {effort: "low"},
        instructions: system,
        input: userPrompt,
        max_output_tokens: 500        
      };
      target_url = OPENAI_RESPONSES_ENDPOINT;
    }

    if (type === "embedding") {
      openaiBody = {
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float"
      };
      target_url = OPENAI_EMBED_ENDPOINT;
    }

    const resp = await fetch(target_url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(openaiBody)
    });

    const data = await resp.text();
    if (resp.ok){
      await incrementUsage(env, userId);
    };
    usage = await getUsage(env, userId);

    return new Response(JSON.stringify({data, usage, limit}), {
      status: resp.status,
      headers: { "Content-Type": "application/json" }
    });
  }
};

function getKey(userId) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  return `${userId}:${month}`;
}

async function getUsage(env, userId) {
  const key = getKey(userId);
  
  const val = await env.USAGE.get(key);
  return Number(val || 0);
};

async function getUser(env, userId){
  const userData = await env.USERS.get(userId, null);
  
  let user;
  if (!userData){
    const newData = {plan: "free", updatedAt: Date.now()};
    user = newData;
    await env.USERS.put(userId, JSON.stringify(newData));
  }
  else {
    user = JSON.parse(userData);
  }
  return user;
}

async function incrementUsage(env, userId) {
  const key = getKey(userId);
  const current = await getUsage(env, userId);
  await env.USAGE.put(key, String(current + 1));
};

async function handlePaddleWebhook(req, env) {
  const body = await req.json();
  
  const eventType = body.event_type;

  if (eventType === "transaction.completed") {
    const userId = body.data?.custom_data?.user_id;
    if (!userId) {
      return Response.json({error: "Missing user_id"}, {status: 400});
    }
    // Mark user as PRO
    await env.USERS.put(userId, JSON.stringify({
      plan: "pro",
      updatedAt: Date.now()
    }));
    console.log("User upgraded:", userId);
  }

  return Response.json({ ok: true });
}