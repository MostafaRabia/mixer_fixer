import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ConnectionStatus, InstructionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, blobToBase64 } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';
import { InstructionOverlay } from './InstructionOverlay';
import { ArrowLeftIcon, VideoCameraIcon, MicrophoneIcon } from '@heroicons/react/24/solid';

// System Instruction optimized for Mosque Audio Engineering with Tool Use
const SYSTEM_INSTRUCTION = `
أنت مهندس صوت خبير متخصص في الأنظمة الصوتية للمساجد (Mosque Sound Systems).
مهمتك هي مساعدة المستخدم في ضبط جهاز الصوت (Mixer/Amplifier) لحل مشاكل الصوت الشائعة.

أنت في مكالمة فيديو وصوت مباشرة.
لديك أداة تسمى "displayInstruction" (عرض تعليمات).
**يجب عليك استخدام هذه الأداة فوراً** عندما يطلب المستخدم تعديلاً محدداً أو عندما تشرح له كيفية ضبط مفتاح معين.

قائمة الأوامر الصوتية وكيفية التفاعل معها:
1. إذا قال "قلل الصدى" (Reduce Echo): استخدم الأداة بـ action="reduce_echo" ورسالة "قلل مفتاح الصدى (Echo/Delay/Rev) لليسار".
2. إذا قال "زود الصدى" (Increase Echo): استخدم الأداة بـ action="increase_echo" ورسالة "ارفع مفتاح الصدى قليلاً لليمين".
3. إذا قال "في زنة" (Buzzing): استخدم الأداة بـ action="fix_buzz" ورسالة "تأكد من الأسلاك أو قلل الـ Gain".
4. إذا قال "الصوت مكتوم" (Muffled): استخدم الأداة بـ action="increase_treble" ورسالة "ارفع مفتاح الـ High/Treble".
5. إذا قال "الصوت بيصفر" (Feedback): استخدم الأداة بـ action="reduce_treble" ورسالة "قلل مفتاح الـ High فوراً".

أسلوبك:
1. تحدث باللهجة المصرية أو لغة عربية بيضاء بسيطة.
2. وجه المستخدم بصرياً باستخدام الأداة، ولفظياً بصوتك.
3. اطلب رؤية الجهاز لتحديد مكان المفاتيح.
`;

// Tool Definition for Visual Guidance
const instructionTool: FunctionDeclaration = {
  name: "displayInstruction",
  description: "Displays a visual instruction card on the user's screen to guide them in fixing audio issues.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The type of action. Enum: ['reduce_echo', 'increase_echo', 'fix_buzz', 'reduce_treble', 'increase_treble', 'reduce_gain', 'increase_volume', 'check_cables', 'success', 'general']"
      },
      message: {
        type: Type.STRING,
        description: "Short Arabic text instruction to display on the screen."
      }
    },
    required: ["action", "message"]
  }
};

interface LiveInterfaceProps {
  onDisconnect: () => void;
}

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ onDisconnect }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<InstructionState | null>(null);
  const instructionTimeoutRef = useRef<number | null>(null);
  
  // Refs for WebRTC/Audio/Video management
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null); // To hold the active session
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Cleanup function
  const stopSession = useCallback(() => {
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Stop frame capturing
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    if (instructionTimeoutRef.current) {
      clearTimeout(instructionTimeoutRef.current);
    }

    // Close Audio Contexts
    if (audioContextRef.current) audioContextRef.current.close();
    if (inputContextRef.current) inputContextRef.current.close();

    // Close session if supported
    sessionRef.current = null;
    
    // Stop any playing audio sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();

    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const handleInstruction = (instruction: InstructionState) => {
    setCurrentInstruction(instruction);
    
    // Clear previous timeout
    if (instructionTimeoutRef.current) {
      clearTimeout(instructionTimeoutRef.current);
    }

    // Auto hide instruction after 8 seconds
    instructionTimeoutRef.current = window.setTimeout(() => {
      setCurrentInstruction(null);
    }, 8000);
  };

  // Initialize Gemini Live Connection
  const connectToGemini = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setErrorMessage('');
      
      // Robust API Key Retrieval:
      // 1. Try process.env.API_KEY (Node/Standard)
      // 2. Try window.process.env.API_KEY (Polyfill from index.tsx)
      // 3. Try import.meta.env.VITE_API_KEY (Vite Direct)
      let apiKey = process.env.API_KEY;
      if (!apiKey) {
        // @ts-ignore
        apiKey = typeof window !== 'undefined' && window.process?.env?.API_KEY;
      }
      if (!apiKey) {
        // @ts-ignore
        apiKey = import.meta?.env?.VITE_API_KEY;
      }
      
      if (!apiKey) {
        throw new Error("MISSING_API_KEY");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Setup Audio Input (Microphone)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }, 
        video: {
          facingMode: 'environment', // Use back camera by default
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      streamRef.current = stream;
      
      // Setup Video Preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Setup Audio Input Processing
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = inputContextRef.current.createMediaStreamSource(stream);
      const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      
      source.connect(processor);
      processor.connect(inputContextRef.current.destination);

      // Setup Audio Output
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Connect to Gemini
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
          },
          tools: [{ functionDeclarations: [instructionTool] }]
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Connection Opened");
            setStatus(ConnectionStatus.CONNECTED);
            
            // START AUDIO STREAMING
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromise.then(session => {
                sessionRef.current = session;
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            // START VIDEO STREAMING
            startVideoStreaming(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Instructions)
            if (message.toolCall) {
              console.log("Tool call received:", message.toolCall);
              const functionCalls = message.toolCall.functionCalls;
              
              if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                if (call.name === 'displayInstruction') {
                  const args = call.args as any;
                  handleInstruction({
                    action: args.action,
                    message: args.message
                  });

                  // Send confirmation back to model
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: "Instruction displayed to user" }
                      }]
                    });
                  });
                }
              }
            }

            // Handle Audio Output
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsAiSpeaking(true);
              if (audioContextRef.current) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  base64ToUint8Array(audioData),
                  audioContextRef.current
                );
                
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                const gainNode = audioContextRef.current.createGain();
                gainNode.gain.value = 1.0; 

                source.connect(gainNode);
                gainNode.connect(audioContextRef.current.destination);
                
                source.addEventListener('ended', () => {
                   sourcesRef.current.delete(source);
                   if (sourcesRef.current.size === 0) setIsAiSpeaking(false);
                });

                source.start(nextStartTimeRef.current);
                sourcesRef.current.add(source);
                
                nextStartTimeRef.current += audioBuffer.duration;
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("Interrupted by user");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAiSpeaking(false);
              // Optionally clear instruction on interruption if desired
              // setCurrentInstruction(null);
            }
          },
          onclose: () => {
            console.log("Connection Closed");
            stopSession();
          },
          onerror: (e) => {
            console.error("Gemini Error", e);
            setErrorMessage("حدث خطأ في الاتصال. حاول مرة أخرى.");
            setStatus(ConnectionStatus.ERROR);
          }
        }
      });

    } catch (error: any) {
      console.error("Setup Error:", error);
      if (error.message === "MISSING_API_KEY") {
        setErrorMessage("مفتاح API غير موجود. يرجى إضافة VITE_API_KEY في إعدادات Netlify.");
      } else {
        setErrorMessage("تعذر الوصول إلى الكاميرا أو الميكروفون.");
      }
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const startVideoStreaming = (sessionPromise: Promise<any>) => {
    // Send frames at 1.5 FPS
    const FPS = 1.5; 
    
    frameIntervalRef.current = window.setInterval(() => {
      if (!canvasRef.current || !videoRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth / 2;
      canvasRef.current.height = videoRef.current.videoHeight / 2;
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      canvasRef.current.toBlob(async (blob) => {
        if (blob) {
          const base64Data = await blobToBase64(blob);
          sessionPromise.then(session => {
             session.sendRealtimeInput({
               media: {
                 mimeType: 'image/jpeg',
                 data: base64Data
               }
             });
          });
        }
      }, 'image/jpeg', 0.6);

    }, 1000 / FPS);
  };

  useEffect(() => {
    connectToGemini();
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === ConnectionStatus.ERROR) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 max-w-sm w-full text-center">
          <p className="text-red-400 mb-4 font-bold">حدث خطأ</p>
          <p className="text-red-200 mb-6 text-sm">{errorMessage}</p>
          <button 
            onClick={onDisconnect}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold transition-colors"
          >
            العودة للقائمة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col">
      {/* Video Viewfinder */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover z-0" 
        autoPlay 
        playsInline 
        muted 
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Visual Instruction Overlay */}
      <InstructionOverlay instruction={currentInstruction} />

      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none">
        
        {/* Header */}
        <div className="flex justify-between items-center pointer-events-auto">
          <button 
            onClick={onDisconnect} 
            className="bg-white/10 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/20"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-xs font-medium text-white/90">
              {status === ConnectionStatus.CONNECTED ? 'متصل بالمهندس' : 'جاري الاتصال...'}
            </span>
          </div>
        </div>

        {/* Center Guide (Optional Overlay) */}
        {!currentInstruction && (
          <div className="flex-1 flex items-center justify-center opacity-30 pointer-events-none transition-opacity duration-500">
             <div className="w-64 h-64 border-2 border-white/50 rounded-lg border-dashed flex items-center justify-center">
                <span className="text-white text-sm">وجّه الكاميرا للجهاز</span>
             </div>
          </div>
        )}

        {/* Footer Controls & Visualizers */}
        <div className="flex flex-col gap-6 items-center pointer-events-auto pb-8 mt-auto">
          
          {/* Status Text / AI Listening Indicator */}
          <div className="text-center space-y-2">
            {isAiSpeaking ? (
               <div className="bg-emerald-500/20 backdrop-blur-md px-6 py-2 rounded-2xl border border-emerald-500/30">
                  <Visualizer active={true} label="المهندس يتحدث..." />
               </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl">
                 <p className="text-sm text-white/80">
                    جرب قل: "قلل الصدى" أو "في زنة"
                 </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
               <VideoCameraIcon className="w-6 h-6 text-white" />
            </div>
            
            <button 
              onClick={onDisconnect}
              className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/30 hover:scale-105 transition-transform"
            >
              <span className="sr-only">إنهاء المكالمة</span>
              <div className="w-6 h-6 bg-white rounded-sm" /> 
            </button>

            <div className="p-4 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
               <MicrophoneIcon className="w-6 h-6 text-white" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};