import OpenAI from "openai";

export const conversationTitleClient =
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });