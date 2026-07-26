import OpenAI from "openai";

export const queryRewriteClient =
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });