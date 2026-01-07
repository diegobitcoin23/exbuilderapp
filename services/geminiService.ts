
import { GoogleGenAI, Modality } from "@google/genai";
import { SYSTEM_PROMPT, TIKTOK_GUIDELINES } from "../constants";
import { AnalysisReport } from "../types";

// Função interna para garantir que sempre usamos a chave do ambiente no momento da chamada
// CRITICAL: Criamos a instância logo antes da chamada para pegar a chave mais atual do dialog
const createAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Redimensiona e comprime uma imagem base64 para garantir que o modelo consiga processá-la.
 */
const resizeImage = (base64: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = () => resolve(base64);
  });
};

const cleanJsonString = (str: string) => {
  return str.replace(/```json/g, '').replace(/```/g, '').trim();
};

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4);

  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
}

export const textToSpeech = async (text: string, voiceName: string = 'Zephyr'): Promise<{ url: string, blob: Blob }> => {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const candidate = response.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find(p => p.inlineData);
  const base64Audio = audioPart?.inlineData?.data;

  if (!base64Audio) {
    throw new Error(`Erro: A voz '${voiceName}' falhou. Tente encurtar o texto ou use a voz feminina.`);
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContext, 24000, 1);
  const wavBlob = audioBufferToWav(audioBuffer);
  
  return {
    url: URL.createObjectURL(wavBlob),
    blob: wavBlob
  };
};

export const studioStrategyAgent = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  const ai = createAIClient();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `Você é o Diretor de Estratégia e Vendas Sênior da exbuilderIA. Sua missão é criar planejamentos de conteúdo que vendem e geram engajamento massivo.`,
      temperature: 0.8,
    },
    history: history,
  });

  const response = await chat.sendMessage({ message: message });
  return response.text;
};

export const refinePromptWithIA = async (simplePrompt: string): Promise<string> => {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ 
      parts: [{ 
        text: `Refine this concept into a highly technical 8k cinematic AI prompt in English: "${simplePrompt}". Return ONLY the prompt text.` 
      }] 
    }]
  });
  return response.text || simplePrompt;
};

export const analyzeVideoWithGemini = async (videoBase64: string, mimeType: string): Promise<AnalysisReport> => {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        parts: [
          { text: `${SYSTEM_PROMPT}\n\nDIRETRIZES:\n${TIKTOK_GUIDELINES}` },
          { inlineData: { data: videoBase64, mimeType } },
          { text: "Analise este vídeo. Verifique conformidade com TikTok 2025. Retorne obrigatoriamente um JSON puro." }
        ]
      }
    ],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    }
  });

  const text = response.text || "{}";
  const report = JSON.parse(cleanJsonString(text)) as AnalysisReport;
  report.type = 'video';

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    report.sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));
  }

  return report;
};

export const analyzeImageWithGemini = async (imageBase64: string, mimeType: string): Promise<AnalysisReport> => {
  const processedBase64 = await resizeImage(imageBase64);
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        parts: [
          { text: `${SYSTEM_PROMPT}\n\nDIRETRIZES:\n${TIKTOK_GUIDELINES}` },
          { inlineData: { data: processedBase64, mimeType: 'image/jpeg' } },
          { text: "Auditoria de imagem com busca na web. Verifique TikTok 2025. Retorne JSON." }
        ]
      }
    ],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    }
  });

  const text = response.text || "{}";
  const report = JSON.parse(cleanJsonString(text)) as AnalysisReport;
  report.type = 'image';

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    report.sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));
  }

  return report;
};

/**
 * Geração de Vídeo com tratamento de erro aprimorado.
 */
export const generateVideoWithVeo = async (
  prompt: string, 
  aspectRatio: '16:9' | '9:16',
  imageBase64?: string,
  onProgress?: (message: string) => void
): Promise<string> => {
  const ai = createAIClient();
  
  onProgress?.("Otimizando prompt e ativos...");
  
  let processedImage = imageBase64;
  if (imageBase64) {
    processedImage = await resizeImage(imageBase64, 1280, 720);
  }

  const videoConfig: any = {
    numberOfVideos: 1,
    resolution: '720p',
    aspectRatio: aspectRatio
  };

  const payload: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: videoConfig
  };

  if (processedImage) {
    payload.image = {
      imageBytes: processedImage,
      mimeType: 'image/jpeg'
    };
  }

  onProgress?.("Enviando requisição ao cluster Veo...");
  let operation = await ai.models.generateVideos(payload);

  while (!operation.done) {
    // CRITICAL: Adicionamos verificação de erro no polling
    if (operation.error) {
       throw new Error(`Veo Engine Error: ${operation.error.message || "A renderização foi interrompida pelo servidor."}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    onProgress?.("Renderizando... isso geralmente leva de 1 a 2 minutos.");
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  if (operation.error) {
     throw new Error(`Veo Final Error: ${operation.error.message}`);
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("O servidor não retornou um link de download válido. Tente um prompt diferente.");

  onProgress?.("Finalizando download do Master MP4...");
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Erro ao baixar o vídeo gerado do servidor de armazenamento.");
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const transcribeAudio = async (audioBase64: string): Promise<string> => {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { text: "Transcreva este áudio fielmente. Apenas texto." },
          { inlineData: { data: audioBase64, mimeType: 'audio/webm' } }
        ]
      }
    ]
  });
  return response.text || "";
};

export const editImageWithGemini = async (imageBase64: string, prompt: string): Promise<string> => {
  const processedBase64 = await resizeImage(imageBase64);
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: processedBase64, mimeType: 'image/jpeg' } },
        { text: prompt },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/jpeg;base64,${part.inlineData.data}`;
  }
  throw new Error("Falha na edição visual.");
};

export const generateImageWithGemini = async (prompt: string): Promise<string> => {
  const ai = createAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/jpeg;base64,${part.inlineData.data}`;
  }
  throw new Error("Falha na geração da imagem.");
};
