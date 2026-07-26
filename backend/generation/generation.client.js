import OpenAI from "openai";

export const generationClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
