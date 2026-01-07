
import React, { useState, useRef, useEffect } from 'react';
import { 
  analyzeVideoWithGemini, 
  analyzeImageWithGemini, 
  transcribeAudio, 
  editImageWithGemini, 
  generateImageWithGemini, 
  generateVideoWithVeo, 
  refinePromptWithIA, 
  textToSpeech, 
  studioStrategyAgent 
} from './services/geminiService';
import { supabase, getProfile, updateCredits, Profile } from './services/supabase';
import { AnalysisReport, VideoFile, ImageFile, ComplianceStatus, AppTab, Severity } from './types';
import { 
  ShieldCheck, AlertTriangle, XCircle, Upload, Loader2, Check,
  Mic, Image as ImageIcon, Sparkles, Wand2, Download, PlusCircle,
  Coins, LogOut, Clapperboard, Play, Save, Sparkle, RefreshCw, StopCircle, 
  Globe, Volume2, Send, Bot, Target, Zap, Copy, Shield, 
  ExternalLink, Info, Lock, Mail, UserPlus, ArrowRight, UserCircle, Key
} from 'lucide-react';

const COSTS = {
  video: 2,
  image: 1,
  editor: 1,
  voice: 1,
  'video-gen': 5,
  'chat-agent': 0.5
};

const CREDIT_PACKS = [
  { id: 'starter', credits: 25, price: '29,90', label: 'Iniciante' },
  { id: 'pro', credits: 120, price: '69,90', label: 'Profissional', popular: true },
  { id: 'enterprise', credits: 350, price: '147,00', label: 'Enterprise' },
];

const MP_CHECKOUT_URL = "https://link.mercadopago.com.br/excryptoia";

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('video');
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(true);
  
  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Studio States
  const [transcription, setTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Zephyr' | 'Masculina'>('Zephyr');
  const [editPrompt, setEditPrompt] = useState('');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'generate' | 'agent'>('agent');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [videoGenPrompt, setVideoGenPrompt] = useState('');
  const [videoGenRefImage, setVideoGenRefImage] = useState<ImageFile | null>(null);
  const [videoGenAspectRatio, setVideoGenAspectRatio] = useState<'16:9' | '9:16'>('9:16');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'selection' | 'processing' | 'success'>('selection');
  const [selectedPack, setSelectedPack] = useState(CREDIT_PACKS[1]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const videoGenImgRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading) setAuthLoading(false);
    }, 3000);

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          const p = await getProfile(currentSession.user.id, currentSession.user.email, currentSession.user.user_metadata?.full_name);
          setProfile(p);
        }
      } catch (e) {
        // Silently fail
      } finally {
        setAuthLoading(false);
        clearTimeout(timeout);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        const p = await getProfile(newSession.user.id, newSession.user.email, newSession.user.user_metadata?.full_name);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (session?.user?.id === 'guest-user') {
      setSession(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
    } catch (e: any) {
      setError("Credenciais inválidas. Verifique seu e-mail e senha.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      setError("Cadastro iniciado! Verifique sua caixa de entrada.");
    } catch (e: any) {
      setError("Erro ao cadastrar. Tente novamente.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = () => {
    const mockSession = {
      user: {
        id: 'guest-user',
        email: 'visitante@exbuilder.ia',
        user_metadata: { full_name: 'Criador Beta' }
      }
    };
    setSession(mockSession);
    setProfile({
      id: 'guest-user',
      email: 'visitante@exbuilder.ia',
      full_name: 'Criador Beta',
      avatar_url: '',
      credits: 100
    });
  };

  const consumeCredits = async (tab: AppTab | 'chat-agent'): Promise<boolean> => {
    if (!profile) return false;
    const cost = COSTS[tab as keyof typeof COSTS] || 0.5;
    if (profile.credits < cost) {
      setShowPaywall(true);
      return false;
    }
    const newBalance = profile.credits - cost;
    if (profile.id === 'guest-user') {
      setProfile({ ...profile, credits: newBalance });
      return true;
    }
    try {
      await updateCredits(profile.id, newBalance);
      setProfile({ ...profile, credits: newBalance });
      return true;
    } catch (e) {
      setError("Erro ao sincronizar saldo.");
      return false;
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const closeCheckout = () => {
    setShowPaywall(false);
    setCheckoutStep('selection');
  };

  const handlePaymentRedirect = () => {
    window.open(MP_CHECKOUT_URL, '_blank');
    setCheckoutStep('processing');
  };

  const handleManualConfirmation = async () => {
    if (profile) {
      const newCredits = profile.credits + selectedPack.credits;
      if (profile.id !== 'guest-user') {
        try {
          await updateCredits(profile.id, newCredits);
          setProfile({ ...profile, credits: newCredits });
        } catch (e) {
          setError("Erro ao atualizar créditos.");
          return;
        }
      } else {
        setProfile({ ...profile, credits: newCredits });
      }
      setCheckoutStep('success');
    }
  };

  const handleRefine = async (source: 'editor' | 'video-gen') => {
    const promptToRefine = source === 'editor' ? editPrompt : videoGenPrompt;
    if (!promptToRefine) return;
    setIsRefining(true);
    try {
      const refined = await refinePromptWithIA(promptToRefine);
      if (source === 'editor') setEditPrompt(refined);
      else setVideoGenPrompt(refined);
    } catch (e) {
      setError("Erro ao refinar com IA.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleAuditVideo = async () => {
    if (!video || !(await consumeCredits('video'))) return;
    setIsAnalyzing(true);
    setReport(null);
    try {
      const base64 = await fileToBase64(video.file);
      const res = await analyzeVideoWithGemini(base64, video.file.type);
      setReport(res);
    } catch (e: any) { setError("Falha na análise master."); } finally { setIsAnalyzing(false); }
  };

  const handleAuditImage = async () => {
    if (!image || !(await consumeCredits('image'))) return;
    setIsAnalyzing(true);
    setReport(null);
    try {
      const res = await analyzeImageWithGemini(image.base64, image.file.type);
      setReport(res);
    } catch (e: any) { setError("Erro no escaneamento visual."); } finally { setIsAnalyzing(false); }
  };

  const handleSendChat = async (directInput?: string) => {
    const input = directInput || chatInput;
    if (!input.trim() || isChatLoading) return;
    if (!(await consumeCredits('chat-agent'))) return;
    setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: input }] }]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const responseText = await studioStrategyAgent(input, chatHistory);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (e) { setError("Erro no Studio Agent."); } finally { setIsChatLoading(false); }
  };

  const handleGenerateVideo = async () => {
    if (!videoGenPrompt || !(await consumeCredits('video-gen'))) return;
    setIsAnalyzing(true);
    setGenProgress("Conectando ao Cluster Veo...");
    try {
      const url = await generateVideoWithVeo(videoGenPrompt, videoGenAspectRatio, videoGenRefImage?.base64, setGenProgress);
      setGeneratedVideoUrl(url);
    } catch (err: any) { setError("Cluster temporariamente instável."); } finally { setIsAnalyzing(false); setGenProgress(""); }
  };

  const handleImageAction = async () => {
    if (!editPrompt || !(await consumeCredits('editor'))) return;
    setIsAnalyzing(true);
    try {
      let res = editorMode === 'edit' ? await editImageWithGemini(image!.base64, editPrompt) : await generateImageWithGemini(editPrompt);
      setEditedImage(res);
    } catch (e: any) { setError("Erro no processamento visual."); } finally { setIsAnalyzing(false); }
  };

  const handleVoiceAction = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!(await consumeCredits('voice'))) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        recorder.onstop = async () => {
          const base64 = await fileToBase64(new File([new Blob(audioChunksRef.current)], "mic.webm"));
          setIsAnalyzing(true);
          try { setTranscription(await transcribeAudio(base64)); } finally { setIsAnalyzing(false); }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (e) { setError("Microfone bloqueado."); }
    }
  };

  const handleGenerateTts = async () => {
    if (!ttsText.trim() || isGeneratingAudio) return;
    if (!(await consumeCredits('voice'))) return;
    setIsGeneratingAudio(true);
    try {
      const { url } = await textToSpeech(ttsText, selectedVoice === 'Masculina' ? 'Kore' : 'Zephyr');
      setGeneratedAudioUrl(url);
    } catch (e: any) { setError("Falha no motor vocal."); } finally { setIsGeneratingAudio(false); }
  };

  if (authLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#010101] text-white">
      <Loader2 className="w-12 h-12 text-[#FE2C55] animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Iniciando Protocolo Master...</p>
    </div>
  );

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#010101] text-white">
        <div className="max-w-md w-full space-y-12 animate-in fade-in zoom-in-95 duration-700">
           <div className="text-center space-y-4">
              <ShieldCheck className="w-20 h-20 text-[#FE2C55] mx-auto animate-pulse" />
              <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">exbuilder</h1>
              <p className="text-gray-500 font-bold uppercase tracking-[0.4em] text-[10px]">Creator AI Suite v3.1</p>
           </div>

           <div className="bg-[#0a0a0a] border border-gray-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
              <div className="space-y-5">
                 <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail Master" className="w-full bg-black border border-gray-800 rounded-2xl p-4 pl-12 text-sm text-white" />
                 </div>
                 <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-gray-800 rounded-2xl p-4 pl-12 text-sm text-white" />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button onClick={handleEmailLogin} disabled={isLoggingIn} className="bg-white text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all">
                    {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Entrar'}
                 </button>
                 <button onClick={handleEmailSignUp} disabled={isLoggingIn} className="bg-transparent border border-gray-800 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all">
                    Criar Conta
                 </button>
              </div>

              <div className="relative py-4 text-center">
                 <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest">Ou Acesso Rápido</span>
              </div>

              <button onClick={handleGuestLogin} className="w-full bg-gradient-to-r from-[#FE2C55] to-purple-600 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all text-white">
                 <Zap className="w-5 h-5 fill-current"/> Testar Como Visitante
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010101] text-white flex flex-col md:flex-row font-sans overflow-hidden">
      <aside className="fixed bottom-0 left-0 w-full h-16 md:h-full md:w-20 bg-[#0a0a0a]/95 backdrop-blur-2xl border-t md:border-t-0 md:border-r border-gray-800 flex flex-row md:flex-col items-center justify-around md:justify-start md:py-8 z-[60]">
        <nav className="flex flex-row md:flex-col gap-1 md:gap-8 w-full items-center justify-around md:justify-start">
          <TabBtn active={activeTab === 'video'} onClick={() => { setActiveTab('video'); setReport(null); }} icon={<ShieldCheck className="w-5 h-5"/>} label="Audit" />
          <TabBtn active={activeTab === 'video-gen'} onClick={() => setActiveTab('video-gen')} icon={<Clapperboard className="w-5 h-5"/>} label="Veo" />
          <TabBtn active={activeTab === 'image'} onClick={() => { setActiveTab('image'); setReport(null); }} icon={<ImageIcon className="w-5 h-5"/>} label="Visão" />
          <TabBtn active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} icon={<Wand2 className="w-5 h-5"/>} label="Studio" />
          <TabBtn active={activeTab === 'voice'} onClick={() => setActiveTab('voice')} icon={<Mic className="w-5 h-5"/>} label="Voz" />
        </nav>
        <div className="mt-0 md:mt-auto flex items-center gap-4 md:flex-col md:pb-6">
           <div onClick={() => setShowPaywall(true)} className="text-[9px] font-black text-[#FE2C55] uppercase flex items-center gap-1 cursor-pointer">
             <Coins className="w-3 h-3"/> {profile?.credits || 0}
           </div>
           <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-white"><LogOut className="w-4 h-4" /></button>
        </div>
      </aside>

      <div className="flex-1 md:ml-20 pb-20 md:pb-0 overflow-y-auto h-screen">
        <header className="h-14 border-b border-gray-800 bg-[#010101]/80 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 md:px-8">
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-gradient-to-br from-[#FE2C55] to-purple-600 rounded-lg"><ShieldCheck className="w-3.5 h-3.5" /></div>
             <h1 className="text-[11px] font-black uppercase tracking-[0.2em]">exbuilder-ia</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black text-white uppercase">{profile?.full_name}</span>
                <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">{profile?.email}</span>
             </div>
             <button onClick={() => setShowPaywall(true)} className="bg-white text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-gray-200">+ Recarga</button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-10 space-y-12">
          {activeTab === 'video-gen' ? (
            <div className="grid lg:grid-cols-2 gap-10 animate-in fade-in duration-500">
              <div className="space-y-6">
                <p className="text-[#FE2C55] text-[10px] font-black uppercase tracking-[0.4em]">Veo Engine v3.1</p>
                <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.85]">Dream <br /> Kinetic</h2>
                <div className="flex flex-wrap gap-2">
                  {["Cyberpunk neon rain", "Cute astronaut cat", "Epic fantasy landscape"].map(s => (
                    <button key={s} onClick={() => setVideoGenPrompt(s)} className="px-3 py-1.5 bg-white/5 border border-gray-800 rounded-lg text-[9px] font-bold uppercase">{s}</button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setVideoGenAspectRatio('9:16')} className={`flex-1 p-6 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${videoGenAspectRatio === '9:16' ? 'border-[#FE2C55] bg-[#FE2C55]/5' : 'border-gray-800'}`}>
                    <div className="w-4 h-6 border-2 border-current rounded-sm"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Vertical</span>
                  </button>
                  <button onClick={() => setVideoGenAspectRatio('16:9')} className={`flex-1 p-6 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${videoGenAspectRatio === '16:9' ? 'border-purple-500 bg-purple-500/5' : 'border-gray-800'}`}>
                    <div className="w-7 h-4 border-2 border-current rounded-sm"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Landscape</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-[3rem] p-8 space-y-8 shadow-2xl relative">
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-[3rem] p-10 text-center text-white">
                    <Loader2 className="w-12 h-12 text-[#FE2C55] animate-spin mb-4"/>
                    <p className="text-xl font-black uppercase tracking-tighter">{genProgress}</p>
                  </div>
                )}
                <div onClick={() => videoGenImgRef.current?.click()} className="h-48 border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-black/40 relative">
                  {videoGenRefImage ? <img src={videoGenRefImage.preview} className="w-full h-full object-cover" /> : <div className="text-center opacity-30"><PlusCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500"/><p className="text-[9px] font-black uppercase tracking-widest">Referência Visual</p></div>}
                </div>
                <input type="file" ref={videoGenImgRef} className="hidden" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const base64 = await fileToBase64(file);
                    setVideoGenRefImage({ file, preview: URL.createObjectURL(file), base64 });
                  }
                }} />
                <textarea value={videoGenPrompt} onChange={(e) => setVideoGenPrompt(e.target.value)} placeholder="Descreva a cena cinematográfica..." className="w-full bg-black border border-gray-800 rounded-2xl p-6 text-sm min-h-[140px] text-white outline-none" />
                <button onClick={handleGenerateVideo} disabled={isAnalyzing || !videoGenPrompt} className="w-full bg-gradient-to-r from-[#FE2C55] to-purple-600 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-4 text-white">
                   <Play className="w-5 h-5 fill-current"/> Gerar Master Veo
                </button>
                {generatedVideoUrl && (
                  <div className="space-y-4 animate-in zoom-in-95 duration-500">
                    <video src={generatedVideoUrl} controls className="w-full rounded-3xl border border-gray-800" />
                    <button onClick={() => downloadFile(generatedVideoUrl, 'exbuilder-veo.mp4')} className="w-full py-4 bg-emerald-500/10 border border-emerald-500 text-emerald-500 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                      <Download className="w-4 h-4"/> Salvar Master
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'editor' ? (
            <div className="grid lg:grid-cols-12 gap-8 h-full lg:h-[720px] animate-in fade-in duration-500">
              <div className="lg:col-span-5 bg-[#0a0a0a] border border-gray-800 rounded-[2.5rem] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-gray-800 bg-black/40 flex items-center gap-3">
                   <Bot className="w-5 h-5 text-purple-400" />
                   <span className="text-[11px] font-black uppercase tracking-widest">Studio Agent Master</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  {chatHistory.map((msg: any, i: number) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] p-5 rounded-3xl text-[12px] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#FE2C55] text-white rounded-tr-none font-bold' : 'bg-[#1a1a1a] border border-gray-800 text-gray-200 rounded-tl-none'}`}>
                        {msg.parts[0].text}
                        {msg.role === 'model' && (
                          <button onClick={() => { setEditPrompt(msg.parts[0].text); setVideoGenPrompt(msg.parts[0].text); }} className="mt-4 text-[9px] font-black uppercase text-emerald-400 flex items-center gap-2">
                             <Copy className="w-3.5 h-3.5"/> Copiar para o Editor
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <Loader2 className="animate-spin w-6 h-6 text-purple-500 mx-auto" />}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-5 bg-black/60 border-t border-gray-800">
                  <div className="relative">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendChat()} placeholder="Peça um roteiro viral..." className="w-full bg-[#111] border border-gray-800 rounded-2xl p-4 pr-14 text-[12px] text-white outline-none" />
                    <button onClick={() => handleSendChat()} disabled={isChatLoading || !chatInput.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-purple-600 text-white rounded-xl"><Send className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="flex gap-2 p-1.5 bg-[#0a0a0a] border border-gray-800 rounded-2xl">
                   <button onClick={() => setEditorMode('edit')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${editorMode === 'edit' ? 'bg-white text-black' : 'text-gray-500'}`}>Editar Foto</button>
                   <button onClick={() => setEditorMode('generate')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${editorMode === 'generate' ? 'bg-white text-black' : 'text-gray-500'}`}>Gerar Arte</button>
                </div>
                <div className="flex-1 bg-[#0a0a0a] border border-gray-800 rounded-[3rem] overflow-hidden flex items-center justify-center relative shadow-2xl">
                   {editedImage ? <img src={editedImage} className="max-h-full max-w-full p-6 object-contain" alt="Edited" /> : image ? <img src={image.preview} className="max-h-full max-w-full p-6 object-contain" alt="Original" /> : <div className="text-center opacity-20"><Sparkles className="w-20 h-20 mx-auto mb-4"/><p className="text-[12px] font-black uppercase tracking-[0.5em]">Studio Ready</p></div>}
                   {isAnalyzing && <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-md z-30"><Loader2 className="animate-spin w-12 h-12 text-purple-500 mb-4" /><p className="text-[10px] font-black uppercase">Processando...</p></div>}
                   {editedImage && <button onClick={() => downloadFile(editedImage!, 'exbuilder-studio.jpg')} className="absolute top-6 right-6 p-4 bg-emerald-500 text-black rounded-2xl"><Save className="w-6 h-6"/></button>}
                </div>
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-[2rem] p-6 space-y-4">
                   <div className="relative">
                      <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Comandos visuais..." className="w-full bg-black border border-gray-800 rounded-2xl p-6 text-[13px] min-h-[100px] text-white outline-none resize-none" />
                      <button onClick={() => handleRefine('editor')} disabled={isRefining} className="absolute bottom-4 right-4 p-2.5 bg-white/5 border border-gray-800 rounded-xl">
                        {isRefining ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400"/> : <Sparkle className="w-4 h-4 text-emerald-400"/>}
                      </button>
                   </div>
                   <button onClick={handleImageAction} disabled={isAnalyzing || !editPrompt} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.3em] text-white">
                      <Zap className="w-6 h-6 fill-current"/> Executar Studio Visual
                   </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'voice' ? (
             <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 animate-in fade-in duration-500">
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                   <div className="space-y-2">
                      <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Protocolo Gravação</h3>
                   </div>
                   <div className="flex justify-center py-6">
                     <button onClick={handleVoiceAction} className={`w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isRecording ? 'bg-red-500 border-red-400 animate-pulse' : 'bg-black border-gray-800'}`}>
                        {isRecording ? <StopCircle className="w-12 h-12 text-white" /> : <Mic className="w-12 h-12 text-[#FE2C55]" />}
                     </button>
                   </div>
                   {transcription && <div className="p-6 bg-black border-l-4 border-emerald-500 rounded-2xl text-[13px] italic text-gray-300">"{transcription}"</div>}
                </div>
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                   <div className="space-y-2">
                      <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Master TTS</h3>
                   </div>
                   <div className="flex gap-3">
                     <button onClick={() => setSelectedVoice('Zephyr')} className={`flex-1 py-4 rounded-2xl border-2 text-[10px] font-black uppercase ${selectedVoice === 'Zephyr' ? 'border-purple-600 bg-purple-600/10 text-white' : 'border-gray-800 text-gray-600'}`}>Feminina</button>
                     <button onClick={() => setSelectedVoice('Masculina')} className={`flex-1 py-4 rounded-2xl border-2 text-[10px] font-black uppercase ${selectedVoice === 'Masculina' ? 'border-purple-600 bg-purple-600/10 text-white' : 'border-gray-800 text-gray-600'}`}>Masculina</button>
                   </div>
                   <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="Texto para voz..." className="w-full bg-black border border-gray-800 rounded-2xl p-6 text-sm text-white outline-none" />
                   <button onClick={handleGenerateTts} disabled={isGeneratingAudio || !ttsText} className="w-full bg-white text-black py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em]">
                      {isGeneratingAudio ? <Loader2 className="animate-spin w-5 h-5"/> : <Volume2 className="w-6 h-6"/>} Gerar Master Áudio
                   </button>
                   {generatedAudioUrl && <audio src={generatedAudioUrl} controls className="w-full h-10 rounded-xl bg-black" />}
                </div>
             </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-10 animate-in fade-in duration-500">
              <div className="space-y-8">
                <div className="space-y-4 text-left">
                  <p className="text-[#FE2C55] text-[10px] font-black uppercase tracking-[0.5em]">Protocolo v3.1</p>
                  <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.8]">Deep <br /> Engine</h2>
                </div>
                <p className="text-sm md:text-lg text-gray-400 text-left font-medium">Auditoria automática baseada nas diretrizes 2025.</p>
                {report && <ReportCard report={report} />}
              </div>
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-[3rem] p-8 md:p-12 space-y-10 shadow-2xl relative overflow-hidden">
                 <div className="flex gap-3 p-1.5 bg-black rounded-3xl border border-gray-800">
                    <button onClick={() => { setActiveTab('video'); setReport(null); }} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase ${activeTab === 'video' ? 'bg-[#FE2C55] text-white' : 'text-gray-500'}`}>Vídeo</button>
                    <button onClick={() => { setActiveTab('image'); setReport(null); }} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase ${activeTab === 'image' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>Imagem</button>
                 </div>
                 <div onClick={() => (activeTab === 'video' ? fileInputRef : imgInputRef).current?.click()} className="h-80 border-4 border-dashed border-gray-800 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer bg-black/40 overflow-hidden relative">
                    {activeTab === 'video' && video ? <video src={video.preview} className="w-full h-full object-contain" controls={false} autoPlay loop muted /> : activeTab === 'image' && image ? <img src={image.preview} className="w-full h-full object-contain p-6" alt="Upload" /> : <Upload className="w-16 h-16 text-white opacity-20"/>}
                 </div>
                 <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) setVideo({ file, preview: URL.createObjectURL(file) }); }} accept="video/*" className="hidden" />
                 <input type="file" ref={imgInputRef} onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const base64 = await fileToBase64(file); setImage({ file, preview: URL.createObjectURL(file), base64 }); } }} accept="image/*" className="hidden" />
                 <button onClick={activeTab === 'video' ? handleAuditVideo : handleAuditImage} disabled={isAnalyzing || (!video && !image)} className="w-full bg-gradient-to-r from-[#FE2C55] to-[#FE2C55]/80 py-6 rounded-[2rem] font-black uppercase text-sm text-white disabled:opacity-50">
                    {isAnalyzing ? <Loader2 className="animate-spin w-7 h-7"/> : <ShieldCheck className="w-7 h-7 inline mr-2"/>} Iniciar Scanner
                 </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showPaywall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 animate-in fade-in">
           <div className="bg-[#0a0a0a] border border-gray-800 w-full max-w-lg rounded-[3rem] p-12 text-center space-y-8 text-white">
              <h3 className="text-4xl font-black uppercase tracking-tighter">Planos Master</h3>
              <div className="grid gap-4">
                {CREDIT_PACKS.map(p => (
                  <div key={p.id} onClick={() => setSelectedPack(p)} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${selectedPack.id === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800'}`}>
                     <div className="flex justify-between items-center">
                        <span className="font-black">{p.credits} Créditos</span>
                        <span className="font-bold">R$ {p.price}</span>
                     </div>
                  </div>
                ))}
              </div>
              <button onClick={handlePaymentRedirect} className="w-full bg-blue-600 py-6 rounded-3xl font-black uppercase text-white">
                 Pagar Mercado Pago
              </button>
              <button onClick={closeCheckout} className="text-gray-500 font-bold uppercase text-[10px]">Fechar</button>
           </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-10 right-10 bg-red-600 text-white p-6 rounded-2xl flex items-center gap-4 z-[100] shadow-2xl">
          <AlertTriangle className="w-6 h-6"/>
          <p className="text-xs font-black uppercase">{error}</p>
          <button onClick={() => setError(null)}><XCircle className="w-5 h-5"/></button>
        </div>
      )}
    </div>
  );
};

const ReportCard: React.FC<{ report: AnalysisReport }> = ({ report }) => {
  const statusColors = {
    [ComplianceStatus.PASS]: 'bg-emerald-500',
    [ComplianceStatus.WARNING]: 'bg-amber-500',
    [ComplianceStatus.FAIL]: 'bg-red-500',
  };

  return (
    <div className="bg-[#111] border border-gray-800 rounded-[2.5rem] p-10 space-y-8 text-left text-white shadow-2xl">
      <div className="flex justify-between items-start">
        <span className={`${statusColors[report.overallStatus]} text-black text-[11px] font-black px-6 py-2 rounded-2xl uppercase`}>{report.overallStatus}</span>
        <p className="text-4xl font-black">{report.riskScore}% <span className="text-[10px] text-gray-500 block">Risk Score</span></p>
      </div>
      <p className="text-sm font-bold leading-relaxed italic">"{report.summary}"</p>
      <div className="space-y-4">
        {report.findings.map((f, i) => (
          <div key={i} className="p-6 bg-white/5 rounded-3xl border-l-[6px] border-[#FE2C55]">
            <p className="text-[10px] font-black text-[#FE2C55] uppercase mb-1">{f.category}</p>
            <p className="text-sm font-bold mb-2">{f.issue}</p>
            <p className="text-[12px] text-gray-400">Recomendação: {f.recommendation}</p>
          </div>
        ))}
      </div>
      {report.sources && report.sources.length > 0 && (
        <div className="space-y-2 border-t border-gray-800 pt-6">
          <p className="text-[10px] font-black uppercase text-gray-500">Fontes Google</p>
          {report.sources.map((s, i) => (
            <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-black rounded-xl border border-gray-800 text-[10px] font-bold">
              {s.title} <ExternalLink className="w-3.5 h-3.5"/>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const TabBtn: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${active ? 'bg-white text-black scale-110 shadow-xl' : 'text-gray-500 hover:text-white'}`}>
    {icon}
    <span className="text-[7px] font-black uppercase mt-1">{label}</span>
  </button>
);

export default App;
