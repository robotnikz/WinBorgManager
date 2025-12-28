import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBorgCommand = async (
  action: 'mount' | 'list' | 'info',
  details: { repoUrl: string; mountPoint?: string; archive?: string }
): Promise<string> => {
  try {
    const prompt = `
      You are a BorgBackup expert assistant.
      Generate a valid 'borg' CLI command for the following action on Windows (Powershell syntax if needed).
      Action: ${action}
      Repository: ${details.repoUrl}
      Mount Point: ${details.mountPoint || 'N/A'}
      Archive: ${details.archive || 'N/A'}

      Only return the raw command string, nothing else.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `# Error generating command. Fallback:\nborg ${action} ${details.repoUrl} ...`;
  }
};

export const explainError = async (errorLog: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Explain this BorgBackup error message simply for a Windows user and suggest a fix:\n\n${errorLog}`,
    });
    return response.text;
  } catch (error) {
    return "Could not analyze the error. Please check your network connection.";
  }
};
