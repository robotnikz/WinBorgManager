import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Simulates a long-running backend process by generating realistic logs via Gemini.
 */
export const simulateBorgProcess = async (
  command: string, 
  onLog: (log: string) => void
): Promise<boolean> => {
  // 1. Initial fake logs
  onLog(`$ ${command}`);
  onLog(`Initializing Borg 1.2.4 on Windows x64...`);
  await new Promise(r => setTimeout(r, 800));

  try {
    // 2. Ask Gemini to generate realistic intermediate logs
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate 6 lines of realistic terminal output for the command '${command}'. 
        If it's a connection check, show SSH handshake. 
        If it's a mount, show FUSE init. 
        If it's an error, show a python traceback.
        Make it look technical.`
    });

    const lines = response.text.split('\n');
    
    // Stream lines with delay to simulate processing time
    for (const line of lines) {
        if (line.trim()) {
            onLog(line);
            // Random delay between 200ms and 800ms
            await new Promise(r => setTimeout(r, Math.random() * 600 + 200));
        }
    }

    onLog(`Process completed successfully.`);
    return true;
  } catch (e) {
    onLog(`Error: Connection timed out.`);
    return false;
  }
};