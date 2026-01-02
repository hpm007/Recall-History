export async function embedText(summary) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${YOUR_API_KEY}`
    },
    body: JSON.stringify({ 
      model: "text-embedding-3-small", 
      input: summary,
      encoding_format: "float"
    })
  });
  
  const data = await resp.json();
  return data.data[0].embedding; // array of floats
}
