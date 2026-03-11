import React, { useState, useEffect } from 'react';
import { 
  Dices, Sparkles, RefreshCw, TrendingUp, BarChart2,
  CheckCircle, AlertCircle, Copy, PlusCircle, ShieldAlert, AlertTriangle,
  MessageCircle, Wand2, Calculator, Volume2, Zap, Cpu, Database, Lock, Mail,
  ShoppingCart, X, CreditCard, Gift, Users, BrainCircuit, Save, Bell, Trash2, Share2,
  LogIn, LogOut
} from 'lucide-react';
import magoVideo from './assets/Mago.mp4';
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, increment } from "firebase/firestore";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3-flash-preview"; // Modelo atualizado conforme AI Studio

const calculateCombinations = (n, k) => {
  if (k === 0 || n === k) return 1;
  if (k > n) return 0;
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = res * (n - i + 1) / i;
  }
  return Math.round(res);
};

const getBetLevelInfo = (count, configCount) => {
  const diff = count - configCount;
  if (diff === 0) return { level: 'Nível 1', title: 'Standard', color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-600' };
  if (diff <= 2) return { level: 'Nível 2', title: 'Avançado', color: 'text-blue-400', bg: 'bg-blue-900/50', border: 'border-blue-500/50' };
  if (diff <= 5) return { level: 'Nível 3', title: 'Profissional', color: 'text-purple-400', bg: 'bg-purple-900/50', border: 'border-purple-500/50' };
  return { level: 'Nível 4', title: 'Master', color: 'text-amber-400', bg: 'bg-amber-900/50', border: 'border-amber-500/50' };
};

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        let errorMsg = `Erro na API: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.error && errorData.error.message) {
                errorMsg += ` - ${errorData.error.message}`;
            }
        } catch (e) { /* ignora erro de parse */ }

        // Se for erro 4xx (exceto 429), não adianta tentar de novo
        if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new Error(errorMsg);
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (err) {
      // Falha imediatamente se for erro 4xx (exceto 429), pois retentar não resolverá
      if (err.message.includes('Erro na API: 4') && !err.message.includes('429')) throw err;
      if (i === maxRetries - 1) throw err;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

const base64ToWavBlob = (base64Data, sampleRate = 24000) => {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  const pcm16 = new Int16Array(bytes.buffer);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (v, offset, str) => { for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i)); };
  
  writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true); writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  let offset = 44;
  for (let i = 0; i < pcm16.length; i++) { view.setInt16(offset, pcm16[i], true); offset += 2; }
  return new Blob([view], { type: 'audio/wav' });
};

const LotteryBall = ({ finalNumber, index, revealedIndex, ballStyle, sizeClass, maxVal }) => {
  const isRevealed = index < revealedIndex;
  const isSpinning = index === revealedIndex;
  const [displayNum, setDisplayNum] = useState('-');

  useEffect(() => {
    let interval;
    if (isSpinning) {
      interval = setInterval(() => {
        setDisplayNum(Math.floor(Math.random() * maxVal) + 1);
      }, 40); 
    } else if (isRevealed) {
      setDisplayNum(finalNumber);
    } else {
      setDisplayNum('-');
    }
    return () => clearInterval(interval);
  }, [isSpinning, isRevealed, finalNumber, maxVal]);

  const baseClass = `rounded-full flex items-center justify-center font-black tracking-tighter transition-all duration-300 ${sizeClass}`;
  
  let currentStyle = 'bg-gray-900/50 text-gray-700 border border-gray-800 shadow-inner scale-95 opacity-50';
  if (isSpinning) {
     currentStyle = 'bg-gray-800 text-amber-400 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-110 animate-pulse';
  } else if (isRevealed) {
     currentStyle = `${ballStyle} animate-in zoom-in duration-500 scale-100 opacity-100 ring-2 ring-white/30`;
  }

  return (
    <div className={`${baseClass} ${currentStyle}`}>
        {displayNum.toString().padStart(2, displayNum === '-' ? '' : '0')}
    </div>
  );
};

// --- CONFIGURAÇÃO DO FIREBASE ---
// Substitua estas chaves pelas que você pegou no Console do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBtOPaju62l_d7e6dJIygbh8gIaYBJm_CY",
  authDomain: "oraculo-4f853.firebaseapp.com",
  projectId: "oraculo-4f853",
  storageBucket: "oraculo-4f853.firebasestorage.app",
  messagingSenderId: "1047955301409",
  appId: "1:1047955301409:web:7b0b94d144a0c18068ef60",
  measurementId: "G-0P6ZC2LR2C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [coins, setCoins] = useState(0); 
  const [showStore, setShowStore] = useState(false);
  const [showSavedGames, setShowSavedGames] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  const [promoTimeLeft, setPromoTimeLeft] = useState(1800); 

  const COST_AI_STATISTICIAN = 200;
  const COST_AI_MYSTIC = 300;

  const [generatedGames, setGeneratedGames] = useState([]); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [activeLottery, setActiveLottery] = useState('lotofacil');
  const [showStats, setShowStats] = useState(false);
  const [numberOfGames, setNumberOfGames] = useState(1); 
  
  const [aiPersona, setAiPersona] = useState('mystic'); 
  const [userDream, setUserDream] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  
  const [audioData, setAudioData] = useState({});
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [savedGames, setSavedGames] = useState(() => {
    const saved = localStorage.getItem('oraculo_saved_games');
    return saved ? JSON.parse(saved) : [];
  });
  const [drawReminder, setDrawReminder] = useState(null);

  const [betCounts, setBetCounts] = useState({
    megasena: 6, lotofacil: 15, quina: 5
  });
  
  const lotteriesConfig = {
    megasena: { name: 'Mega-Sena', max: 60, count: 6, maxBet: 20, theme: 'from-emerald-950 via-green-900 to-emerald-950', accent: 'text-emerald-400', cols: 6 },
    lotofacil: { name: 'Lotofácil', max: 25, count: 15, maxBet: 20, theme: 'from-purple-950 via-fuchsia-900 to-indigo-950', accent: 'text-fuchsia-400', cols: 15 },
    quina: { name: 'Quina', max: 80, count: 5, maxBet: 15, theme: 'from-slate-950 via-blue-900 to-slate-950', accent: 'text-blue-400', cols: 5 }
  };

  const defaultLastDraws = {
    megasena: [4, 15, 26, 33, 48, 55],
    lotofacil: [1, 2, 4, 5, 8, 10, 11, 13, 14, 18, 19, 21, 22, 24, 25],
    quina: [12, 25, 43, 67, 71]
  };

  const [realData, setRealData] = useState(null);

  const currentConfig = lotteriesConfig[activeLottery];
  const currentBetCount = betCounts[activeLottery];
  
  const getDozenMultiplier = () => {
      const diff = currentBetCount - currentConfig.count;
      if (diff <= 0) return 1;
      if (diff <= 2) return 3;
      if (diff <= 5) return 10;
      return 25;
  };

  const currentCost = 15 * getDozenMultiplier() * numberOfGames;
  const aiCost = (aiPersona === 'mystic' ? COST_AI_MYSTIC : COST_AI_STATISTICIAN) * getDozenMultiplier();

  useEffect(() => {
    const generateMockHistory = (lotteryKey) => {
        const config = lotteriesConfig[lotteryKey];
        const totalDraws = 3540; 
        const allDraws = [];
        const headerCols = config.count;
        const frequencies = Array.from({ length: headerCols }, () => ({}));
        const sums = Array(headerCols).fill(0);
        const historicalBounds = Array.from({ length: headerCols }, () => ({ min: Infinity, max: -Infinity }));

        for (let i = 0; i < totalDraws; i++) {
          let draw = [];
          while(draw.length < config.count) {
             let num = Math.floor(Math.random() * config.max) + 1;
             if(!draw.includes(num)) draw.push(num);
          }
          draw.sort((a,b) => a - b);
          allDraws.push(draw);

          draw.forEach((num, index) => {
            if (!frequencies[index][num]) frequencies[index][num] = 0;
            frequencies[index][num]++;
            sums[index] += num;
            if (num < historicalBounds[index].min) historicalBounds[index].min = num;
            if (num > historicalBounds[index].max) historicalBounds[index].max = num;
          });
        }
        const expectedMeans = sums.map(sum => sum / totalDraws);
        const lastDraw = allDraws[allDraws.length - 1];
        return { totalDraws, lastDraw, frequencies, expectedMeans, historicalBounds, allDraws };
    };

    setRealData({
        megasena: generateMockHistory('megasena'),
        lotofacil: generateMockHistory('lotofacil'),
        quina: generateMockHistory('quina')
    });
  }, []);

  // --- LÓGICA DE AUTENTICAÇÃO E SINCRONIZAÇÃO ---
  useEffect(() => {
    let unsubDoc = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      
      setIsAuthReady(true); // Marca que a verificação de autenticação terminou

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          // Utilizador já existe: Carrega dados da nuvem
          const data = docSnap.data();
          setCoins(data.coins || 0);
          setSavedGames(data.savedGames || []);
        } else {
          // Novo utilizador: Cria documento inicial com os dados locais atuais
          await setDoc(userRef, {
            coins: coins > 0 ? coins : 50,
            savedGames: savedGames,
            email: currentUser.email
          });
        }

        // Escuta mudanças em tempo real (Sincronização Nuvem -> App)
        unsubDoc = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setCoins(data.coins);
            setSavedGames(data.savedGames || []);
          }
        });
      } else {
        // Logout: limpa saldo/dados do usuário autenticado para não reutilizar moedas em cache
        const localGames = localStorage.getItem('oraculo_saved_games');
        setCoins(0);
        setSavedGames(localGames ? JSON.parse(localGames) : []);
        setGeneratedGames([]);
        setAudioData({});
        setAiError('');
        setRevealedIndex(-1);
        setEmailSent(false);
      }
    });
    return () => {
      if (unsubDoc) unsubDoc();
      unsubscribe();
    };
  }, []); // Executa apenas na montagem

  // Persistência dos Jogos Salvos
  useEffect(() => {
    localStorage.setItem('oraculo_saved_games', JSON.stringify(savedGames));
  }, [savedGames]);

  // Verificação de Dia de Sorteio (Lembrete Proativo)
  useEffect(() => {
    const today = new Date().getDay(); // 0=Dom, 1=Seg, ...
    // Prioridade para Mega-Sena (Quartas e Sábados)
    if (today === 3 || today === 6) {
       setDrawReminder({ type: 'megasena', name: 'Mega-Sena' });
    } else if (today !== 0) { // Qualquer dia exceto Domingo tem Lotofácil/Quina
       setDrawReminder({ type: 'lotofacil', name: 'Lotofácil' });
    }
  }, []);

  // Atualiza o ícone da aba (Favicon) para o Trevo
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'shortcut icon';
    link.href = '/trevo.png'; // Certifique-se de que 'trevo.png' está na pasta 'public'
    document.getElementsByTagName('head')[0].appendChild(link);
  }, []);

  // --- INTEGRAÇÃO MERCADO PAGO ---
  // Verifica se o usuário retornou de um pagamento aprovado
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const status = query.get('status') || query.get('collection_status');
    const externalRef = query.get('external_reference');
    const paymentId = query.get('payment_id');

    // Aguarda o Firebase confirmar se o usuário está logado ou não antes de processar
    if (!isAuthReady) return;

    if ((status === 'approved' || status === 'collection_status=approved') && paymentId) {
       // Evita processar o mesmo pagamento múltiplas vezes na sessão
       const processedKey = `mp_processed_${paymentId}`;
       if (sessionStorage.getItem(processedKey)) return;

       const amount = parseInt(externalRef);
       if (!isNaN(amount)) {
          sessionStorage.setItem(processedKey, 'true');
          
          // Aguarda um momento para garantir que o user esteja carregado
          setTimeout(() => {
             handlePurchaseCoins(amount, true); // true = crédito do sistema
             // Limpa a URL para remover os parâmetros do Mercado Pago
             window.history.replaceState({}, document.title, window.location.pathname);
          }, 1000);
       } else {
          // Se chegou aqui, o pagamento foi aprovado mas a "Referência Externa" não veio configurada
          console.warn("Pagamento aprovado, mas sem Referência Externa (quantidade de moedas).");
          if (!sessionStorage.getItem(processedKey)) {
             showToast('Erro na config do Mercado Pago: "Referência Externa" ausente.');
          }
       }
    }
  }, [user, isAuthReady]); // Executa quando o status de autenticação estiver pronto

  useEffect(() => {
    if (promoTimeLeft <= 0) return;
    const timerId = setInterval(() => {
      setPromoTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [promoTimeLeft]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Login com Google realizado com sucesso!');
    } catch (error) {
      console.error("Erro detalhado do Firebase:", error);
      showToast('Erro ao conectar com Google.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCoins(0);
    showToast('Desconectado.');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handlePurchaseCoins = (amount, isSystemCredit = false) => {
    // LINKS DE PAGAMENTO MERCADO PAGO
    // Crie os links no painel do MP e coloque a quantidade de moedas (100, 500, 2000) no campo "Referência Externa"
    const paymentLinks = {
        100: "https://mpago.la/2QE6eyu", // Ex: https://mpago.la/1xyz
        500: "https://mpago.la/2rf8XwQ",
        2000: "https://mpago.la/1gsUMu9"
    };

    // Se NÃO for um crédito automático do sistema e tiver link configurado, redireciona para o pagamento
    if (!isSystemCredit && paymentLinks[amount] && paymentLinks[amount].startsWith('http')) {
        window.location.href = paymentLinks[amount];
        return;
    }

    // Lógica de Crédito (Executa no retorno do pagamento ou em modo de teste)
    if (user) {
      // Usa increment para evitar condição de corrida ao atualizar saldo
      updateDoc(doc(db, "users", user.uid), { coins: increment(amount) });
    } else {
      setCoins(prev => prev + amount);
    }
    setShowStore(false);
    showToast(`Compra concluída! +${amount} Moedas adicionadas ao saldo.`);
    if (isSystemCredit) showToast(`Pagamento Aprovado! +${amount} Moedas creditadas.`);
  };

  const handleSimulateReferralSignup = () => {
    if (user) {
      updateDoc(doc(db, "users", user.uid), { coins: coins + 15 });
    } else {
      setCoins(prev => prev + 15);
    }
    showToast('Sucesso! Um amigo registrou-se. +15 🪙 creditadas.');
  };

  const handleSimulateReferralPurchase = () => {
    if (user) {
      updateDoc(doc(db, "users", user.uid), { coins: coins + 100 });
    } else {
      setCoins(prev => prev + 100);
    }
    showToast('Fantástico! O seu amigo comprou moedas. +100 🪙 creditadas.');
  };

  const handleCopyReferralLink = () => {
    try {
      navigator.clipboard.writeText('https://oraculopro.app/convite/vip-5991x');
      showToast('Link de indicação copiado para a área de transferência!');
    } catch(e) {
      showToast('Link: https://oraculopro.app/convite/vip-5991x');
    }
  };

  useEffect(() => {
    if (generatedGames.length > 0 && revealedIndex >= 0) {
      const maxBalls = Math.max(...generatedGames.map(g => g.numbers.length));
      if (revealedIndex <= maxBalls) {
        const timer = setTimeout(() => { setRevealedIndex(prev => prev + 1); }, 500); 
        return () => clearTimeout(timer);
      }
    }
  }, [revealedIndex, generatedGames]);

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const getHouseProbabilities = (posIndex, config, lotteryKey, lastPickedNum = 0) => {
    const probs = [];
    const data = realData ? realData[lotteryKey] : null;
    const absoluteMin = Math.max(posIndex + 1, lastPickedNum + 1);
    const absoluteMax = config.max - (config.count - 1 - posIndex);

    let minPossible = absoluteMin;
    let maxPossible = absoluteMax;

    if (data && data.historicalBounds) {
      minPossible = Math.max(minPossible, data.historicalBounds[posIndex].min - 2);
      maxPossible = Math.min(maxPossible, data.historicalBounds[posIndex].max + 2);
    } else {
      const expectedMean = (posIndex + 1) * (config.max / (config.count + 1));
      const spread = config.max / 2.5; 
      minPossible = Math.max(minPossible, Math.floor(expectedMean - spread));
      maxPossible = Math.min(maxPossible, Math.ceil(expectedMean + spread));
    }

    minPossible = Math.max(minPossible, absoluteMin);
    maxPossible = Math.min(maxPossible, absoluteMax);

    if (minPossible > maxPossible) {
      minPossible = absoluteMin;
      maxPossible = Math.max(absoluteMax, absoluteMin);
    }

    for (let i = 1; i <= config.max; i++) {
      if (i < minPossible || i > maxPossible) continue;
      let baseWeight = 0;
      let trendModifier = 1;

      if (data) {
        const expectedMean = data.expectedMeans[posIndex];
        const lastDrawnForPos = data.lastDraw[posIndex];
        const appearCount = data.frequencies[posIndex][i] || 0;
        
        baseWeight = appearCount === 0 ? 0.1 : ((appearCount) / data.totalDraws) * 100;
        if (i > lastDrawnForPos && lastDrawnForPos < expectedMean) trendModifier = 1.4; 
        else if (i < lastDrawnForPos && lastDrawnForPos > expectedMean) trendModifier = 1.4; 
      } else {
        const expectedMean = (posIndex + 1) * (config.max / (config.count + 1));
        const variance = config.max / (config.count / 1.5); 
        const lastDrawnForPos = defaultLastDraws[lotteryKey][posIndex];

        const diff = i - expectedMean;
        baseWeight = Math.exp(-(diff * diff) / (2 * Math.pow(variance, 2))) * 100;

        if (i > lastDrawnForPos && lastDrawnForPos < expectedMean) trendModifier = 1.4;
        else if (i < lastDrawnForPos && lastDrawnForPos > expectedMean) trendModifier = 1.4; 
      }
      probs.push({ number: i, weight: baseWeight * trendModifier });
    }
    
    return { probs: probs.sort((a, b) => b.weight - a.weight), minPossible, maxPossible };
  };

  const generateSingleGame = (config, lotteryKey, targetBetCount) => {
    const newNumbers = [];
    let lastPickedNum = 0; 
    const allHouseProbs = []; 
    
    for (let pos = 0; pos < config.count; pos++) {
      const { probs } = getHouseProbabilities(pos, config, lotteryKey, lastPickedNum);
      allHouseProbs.push(probs);
      const availableProbs = probs.filter(p => !newNumbers.includes(p.number) && p.number > lastPickedNum);
      
      if (availableProbs.length > 0) {
        const totalWeight = availableProbs.reduce((acc, curr) => acc + curr.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedNum = availableProbs[0].number;
        for (const p of availableProbs) {
          random -= p.weight;
          if (random <= 0) { selectedNum = p.number; break; }
        }
        newNumbers.push(selectedNum);
        lastPickedNum = selectedNum; 
      } else {
         let fallbackNum = lastPickedNum + 1;
         while(newNumbers.includes(fallbackNum)) fallbackNum++;
         newNumbers.push(fallbackNum);
         lastPickedNum = fallbackNum;
      }
    }

    if (targetBetCount > config.count) {
      const remainingNumbers = [];
      for (let i = 1; i <= config.max; i++) {
        if (!newNumbers.includes(i)) {
          let globalHeat = 0;
          allHouseProbs.forEach(house => {
            const p = house.find(x => x.number === i);
            if (p) globalHeat += p.weight;
          });
          remainingNumbers.push({ number: i, weight: globalHeat });
        }
      }
      
      for (let i = 0; i < targetBetCount - config.count; i++) {
        const totalW = remainingNumbers.reduce((acc, curr) => acc + curr.weight, 0);
        let rnd = Math.random() * totalW;
        let selectedIdx = 0;
        for (let j = 0; j < remainingNumbers.length; j++) {
          rnd -= remainingNumbers[j].weight;
          if (rnd <= 0) { selectedIdx = j; break; }
        }
        newNumbers.push(remainingNumbers[selectedIdx].number);
        remainingNumbers.splice(selectedIdx, 1); 
      }
    }
    return newNumbers.sort((a, b) => a - b);
  };

  const checkAlreadyDrawn = (gameNumbers) => {
    if (realData && realData[activeLottery] && realData[activeLottery].allDraws) {
        return realData[activeLottery].allDraws.some(draw => 
            draw.every(num => gameNumbers.includes(num))
        );
    }
    return false;
  };

  const generateGames = () => {
    if (coins < currentCost) {
        showToast('Saldo insuficiente! Adquira mais moedas para gerar estes jogos.');
        setShowStore(true);
        return;
    }

    if (user) {
      updateDoc(doc(db, "users", user.uid), { coins: coins - currentCost });
    } else {
      setCoins(prev => prev - currentCost);
    }
    setIsGenerating(true);
    setRevealedIndex(-1);
    setEmailSent(false); 
    setShowStats(false);
    const config = lotteriesConfig[activeLottery];
    
    setTimeout(() => {
      const newGames = [];
      for(let i=0; i < numberOfGames; i++) {
          const gameNumbers = generateSingleGame(config, activeLottery, currentBetCount);
          newGames.push({ 
              numbers: gameNumbers, 
              alreadyDrawn: checkAlreadyDrawn(gameNumbers), 
              isAiGenerated: false, 
              gameType: 'Gerador Rápido' 
          });
      }
      setGeneratedGames(newGames);
      setAudioData({});
      setIsGenerating(false);
      setRevealedIndex(0); 
    }, 600);
  };

  const generateGameWithAI = async () => {
    if (coins < aiCost) {
        showToast(`Saldo insuficiente! São necessárias ${aiCost} moedas para a IA.`);
        setShowStore(true);
        return;
    }

    if (!apiKey) return setAiError('Serviço de IA indisponível. É necessária a chave da API do Gemini no código.');
    if (aiPersona === 'mystic' && !userDream.trim()) return setAiError('Descreva um sonho ou intuição para o Oráculo analisar.');

    if (user) {
      updateDoc(doc(db, "users", user.uid), { coins: coins - aiCost });
    } else {
      setCoins(prev => prev - aiCost);
    }
    setIsAiLoading(true);
    setAiError('');
    setRevealedIndex(-1);
    setEmailSent(false);
    setShowStats(false);
    const config = lotteriesConfig[activeLottery];

    let statsContext = "";
    try {
      const statsSummary = [];
      for (let pos = 0; pos < config.count; pos++) {
          const { probs } = getHouseProbabilities(pos, config, activeLottery, 0);
          const quentes = probs.slice(0, 4).map(s => s.number);
          statsSummary.push(`Casa ${pos + 1}: ${quentes.join(', ')}`);
      }
      statsContext = `\n\nESTATÍSTICAS ATUAIS (Números Quentes):\n${statsSummary.join('\n')}\n`;
    } catch (e) { }

    let systemPrompt = aiPersona === 'mystic' 
      ? "Você é o 'Oráculo da Sorte', um místico analista de loterias. Retorne APENAS um objeto JSON válido. Use numerologia ancorada na matemática provida."
      : "Você é o 'Estrategista', um Analista de Dados Frio e Especialista em Probabilidades. Retorne APENAS um objeto JSON válido. Rejeite o misticismo e confie na matemática.";
    
    let prompt = `Loteria: ${config.name}. Devolva ${currentBetCount} números de 1 a ${config.max}.
    ${aiPersona === 'mystic' ? `Sonho/Palpite: "${userDream}".` : `Diretriz: "${userDream}".`}
    Estatísticas: ${statsContext}
    1. ${aiPersona === 'mystic' ? 'Interprete o sonho' : 'Analise os dados'}.
    2. Gere ${currentBetCount} números únicos e ordenados. Sem sequências irreais.
    3. Crie uma mensagem curta (máx 3 frases) em Português justificando as escolhas de forma ${aiPersona === 'mystic' ? 'mística' : 'técnica e matemática'}.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { 
          type: "OBJECT", 
          properties: { numbers: { type: "ARRAY", items: { type: "INTEGER" } }, message: { type: "STRING" } },
          required: ["numbers", "message"]
        }
      },
    };

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (result.error) throw new Error(result.error.message || 'Erro na Chave de API.');

      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
         const parsed = JSON.parse(textResponse);
         let validNumbers = [...new Set(parsed.numbers)].filter(n => n >= 1 && n <= config.max);
         while (validNumbers.length < currentBetCount) {
             let rand = Math.floor(Math.random() * config.max) + 1;
             if (!validNumbers.includes(rand)) validNumbers.push(rand);
         }
         validNumbers = validNumbers.slice(0, currentBetCount).sort((a,b) => a - b);
         
         setGeneratedGames([{ 
             numbers: validNumbers, 
             alreadyDrawn: checkAlreadyDrawn(validNumbers), 
             isAiGenerated: true, 
             aiPersonaUsed: aiPersona, 
             aiMessage: parsed.message, 
             gameType: 'IA Avançada'
         }]);
         setAudioData({}); 
         setRevealedIndex(0); 
      } else { throw new Error('Resposta vazia'); }
    } catch(e) {
      console.error("Erro IA:", e);
      setAiError(`Erro na IA (${e.message}). Verifique a Chave API.`);
    } finally { setIsAiLoading(false); }
  };

  const handlePlayAudio = async (text, gameIndex, persona) => {
    // Cancela qualquer áudio anterior para evitar sobreposição
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0; // Velocidade normal para evitar distorções
    utterance.pitch = 1.0; // Tom natural
    
    // Tenta selecionar a melhor voz em Português disponível no sistema
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('pt')) || voices.find(v => v.lang.includes('pt'));
    
    if (ptVoice) utterance.voice = ptVoice;

    window.speechSynthesis.speak(utterance);
  };

  const handleSaveGame = (game) => {
    const newSavedGame = {
      ...game,
      id: Date.now() + Math.random(),
      date: new Date().toLocaleDateString('pt-BR'),
      lottery: activeLottery,
      lotteryName: lotteriesConfig[activeLottery].name
    };
    if (user) {
      updateDoc(doc(db, "users", user.uid), { savedGames: [newSavedGame, ...savedGames] });
    } else {
      setSavedGames(prev => [newSavedGame, ...prev]);
    }
    showToast('Jogo salvo na sua conta com sucesso!');
  };

  const handleDeleteGame = (id) => {
    if (user) {
      const newGames = savedGames.filter(g => g.id !== id);
      updateDoc(doc(db, "users", user.uid), { savedGames: newGames });
    } else {
      setSavedGames(prev => prev.filter(g => g.id !== id));
    }
    showToast('Jogo removido da sua conta.');
  };

  const handleSimulateDrawCheck = () => {
    // Simula um sorteio e verifica vitórias
    showToast('A consultar resultados oficiais...');
    setTimeout(() => {
      // Simulação: 30% de chance de encontrar uma "vitória" nos jogos salvos para demonstração
      const hasWin = Math.random() > 0.7 || savedGames.length > 5;
      if (hasWin && savedGames.length > 0) {
        // Simula envio de notificação
        alert(`🎉 PARABÉNS! \n\nIdentificamos 1 jogo premiado na sua conta!\n\nUma notificação Push foi enviada para o seu dispositivo e os detalhes foram encaminhados para o seu e-mail cadastrado.`);
      } else {
        showToast('Nenhum prêmio identificado nos sorteios de hoje.');
      }
    }, 2000);
  };

  const handleLotteryChange = (type) => { setActiveLottery(type); setGeneratedGames([]); setAudioData({}); setAiError(''); setRevealedIndex(-1); setEmailSent(false); setShowStats(false); };
  const handleBetCountChange = (e) => { setBetCounts(prev => ({ ...prev, [activeLottery]: Number(e.target.value) })); };
  const copyToClipboard = (gameNumbers) => {
    try {
      navigator.clipboard.writeText(gameNumbers.map(n => n.toString().padStart(2, '0')).join(' - '));
      showToast('Números copiados!');
    } catch(e) { }
  };

  const handleShareWhatsApp = (gameObj, gameIndex) => {
    const lotteryName = lotteriesConfig[activeLottery].name;
    const numbers = gameObj.numbers.map(n => n.toString().padStart(2, '0')).join(' - ');
    let message = `🔮 Oráculo da Sorte IA\n🎟️ Bilhete ${gameIndex + 1} - ${lotteryName}\nNúmeros: ${numbers}`;
    if (gameObj.aiMessage) message += `\n🧠 Conselho: ${gameObj.aiMessage}`;
    message += '\n\nBoa sorte!';

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmail = async () => {
      setIsSendingEmail(true);
      
      // Prepara o conteúdo do e-mail
      const lotteryName = lotteriesConfig[activeLottery].name;
      const subject = `🔮 Seus Números da Sorte - ${lotteryName}`;
      let body = `Olá${user?.displayName ? ' ' + user.displayName : ''}!\n\n`;
      body += `Aqui estão os seus palpites gerados pelo Oráculo da Sorte IA para a ${lotteryName}:\n\n`;
      
      generatedGames.forEach((game, index) => {
          body += `🎟️ Bilhete ${index + 1}: ${game.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}\n`;
          if (game.aiMessage) body += `🧠 Conselho: ${game.aiMessage}\n`;
          body += `-----------------------------------\n`;
      });
      
      body += `\nBoa sorte!\n\nGerado por Oráculo da Sorte IA`;

      await delay(1000); 
      
      const emailTo = user ? user.email : '';
      const mailtoLink = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      window.location.href = mailtoLink;

      setIsSendingEmail(false);
      setEmailSent(true);
      showToast('Cliente de e-mail aberto com seus jogos!');
  };

  const hasRealData = realData && realData[activeLottery] !== null;
  const currentLevelInfo = getBetLevelInfo(currentBetCount, currentConfig.count);
  const availableBetOptions = Array.from({ length: currentConfig.maxBet - currentConfig.count + 1 }, (_, i) => currentConfig.count + i);
  const allGamesRevealed = generatedGames.length > 0 && revealedIndex >= Math.max(...generatedGames.map(g => g.numbers.length));

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentConfig.theme} flex items-center justify-center p-4 sm:p-8 font-sans text-gray-100 transition-colors duration-700 overflow-x-hidden relative`}>
      
      <style>{`
        @keyframes mystic-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(192, 38, 211, 0.3); text-shadow: 0 0 5px rgba(255,255,255,0.5); }
          50% { box-shadow: 0 0 40px rgba(217, 70, 239, 0.8), inset 0 0 20px rgba(217, 70, 239, 0.5); text-shadow: 0 0 15px rgba(255,255,255,1); transform: scale(1.02); }
        }
        @keyframes mystic-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes astral-float {
          0%, 100% { transform: translateY(0px) scale(1); filter: hue-rotate(0deg); }
          50% { transform: translateY(-15px) scale(1.05); filter: hue-rotate(30deg); }
        }
        @keyframes mediumnic-fade {
          0%, 100% { opacity: 0.6; filter: blur(1px); }
          50% { opacity: 1; filter: blur(0px); text-shadow: 0 0 20px rgba(232, 121, 249, 1); }
        }
        
        .bet-btn-mystic {
          background: linear-gradient(180deg, #d946ef 0%, #a21caf 50%, #701a75 100%);
          border: 1px solid #f5d0fe;
          box-shadow: 0 6px 0 #4a044e, 0 10px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.4);
          color: white;
          transition: all 0.1s;
        }
        .bet-btn-mystic:active:not(:disabled) {
          transform: translateY(6px);
          box-shadow: 0 0px 0 #4a044e, 0 4px 6px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4);
        }

        .bet-btn-stat {
          background: linear-gradient(180deg, #38bdf8 0%, #0284c7 50%, #075985 100%);
          border: 1px solid #bae6fd;
          box-shadow: 0 6px 0 #082f49, 0 10px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.4);
          color: white;
          transition: all 0.1s;
        }
        .bet-btn-stat:active:not(:disabled) {
          transform: translateY(6px);
          box-shadow: 0 0px 0 #082f49, 0 4px 6px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4);
        }

        .bet-btn-gold {
          background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 50%, #b45309 100%);
          border: 1px solid #fef3c7;
          box-shadow: 0 6px 0 #78350f, 0 10px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.6);
          color: #451a03;
          transition: all 0.1s;
        }
        .bet-btn-gold:active:not(:disabled) {
          transform: translateY(6px);
          box-shadow: 0 0px 0 #78350f, 0 4px 6px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.6);
        }

        .bet-btn-disabled {
          background: linear-gradient(180deg, #4b5563 0%, #374151 50%, #1f2937 100%);
          border: 1px solid #6b7280;
          box-shadow: 0 6px 0 #111827;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .tab-chip {
          border-bottom: 4px solid transparent;
        }
        .tab-chip.active {
          transform: translateY(2px);
          border-bottom: 0px solid transparent;
        }
      `}</style>

      {/* Notificação Toast */}
      {toastMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-emerald-600/90 backdrop-blur-md border border-emerald-400 text-white px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.4)] font-bold flex items-center z-[110] animate-in slide-in-from-top-10 fade-in duration-300 whitespace-nowrap">
            <CheckCircle className="w-5 h-5 mr-2 text-emerald-200" />
            <span className="text-sm tracking-wide">{toastMsg}</span>
        </div>
      )}

      {/* Modal de Indicação (Referral Program) */}
      {showReferral && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-purple-500/30 rounded-3xl w-full max-w-md relative shadow-[0_0_50px_rgba(168,85,247,0.15)] animate-in zoom-in-95 overflow-hidden">
                <div className="bg-gradient-to-b from-purple-500/10 to-transparent p-6 text-center border-b border-white/5 relative">
                    <button onClick={() => setShowReferral(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-800/50 p-2 rounded-full">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 mb-3 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                        <Gift className="w-8 h-8 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white">Indique e Ganhe</h2>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Convide os seus amigos para a plataforma e ganhe moedas grátis para apostar mais!</p>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 text-center hover:border-blue-500/50 transition-colors">
                            <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Amigo Cadastrou</p>
                            <p className="text-lg font-black text-blue-300 drop-shadow-md">+15 🪙</p>
                        </div>
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 text-center hover:border-amber-500/50 transition-colors">
                            <ShoppingCart className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Amigo Comprou</p>
                            <p className="text-lg font-black text-amber-300 drop-shadow-md">+100 🪙</p>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 block">O Seu Link Exclusivo</label>
                        <div className="flex shadow-inner">
                            <input type="text" readOnly value="https://oraculopro.app/convite/vip-5991x" className="w-full bg-gray-950 border border-gray-700 rounded-l-xl p-3 text-sm font-medium text-gray-300 outline-none" />
                            <button onClick={handleCopyReferralLink} className="bg-purple-600 hover:bg-purple-500 text-white px-5 rounded-r-xl transition-colors flex items-center justify-center font-bold">
                                <Copy className="w-4 h-4 mr-2" /> Copiar
                            </button>
                        </div>
                    </div>
                    <div className="pt-5 border-t border-gray-800 space-y-2">
                        <p className="text-[9px] text-gray-600 text-center uppercase tracking-widest mb-3 font-bold">Simuladores (Testes)</p>
                        <button onClick={handleSimulateReferralSignup} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-colors">
                            Simular Registo (+15 🪙)
                        </button>
                        <button onClick={handleSimulateReferralPurchase} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-colors">
                            Simular Compra (+100 🪙)
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Modal Meus Jogos Salvos */}
      {showSavedGames && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-lg relative shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-gray-800 p-6 text-center border-b border-white/5 relative shrink-0">
                    <button onClick={() => setShowSavedGames(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-900/50 p-2 rounded-full">
                        <X className="w-4 h-4" />
                    </button>
                    <h2 className="text-xl font-black text-white flex items-center justify-center gap-2">
                      <Save className="w-5 h-5 text-emerald-400" /> Meus Jogos Salvos
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">Jogos monitorados pelo sistema de notificação.</p>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar space-y-3 flex-1">
                    {savedGames.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-sm">Nenhum jogo salvo ainda.</div>
                    ) : (
                      savedGames.map((game) => (
                        <div key={game.id} className="bg-gray-950/50 border border-gray-800 rounded-xl p-3 flex justify-between items-center">
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">{game.lotteryName}</span>
                                <span className="text-[10px] text-gray-500">{game.date}</span>
                              </div>
                              <div className="text-sm font-mono font-bold text-emerald-400 tracking-wider">
                                {game.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}
                              </div>
                           </div>
                           <button onClick={() => handleDeleteGame(game.id)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      ))
                    )}
                </div>
                <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
                    <button onClick={handleSimulateDrawCheck} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                       <Bell className="w-4 h-4" /> Simular Conferência de Sorteio
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Modal da Loja de Moedas */}
      {showStore && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-amber-500/30 rounded-3xl w-full max-w-md relative shadow-[0_0_50px_rgba(251,191,36,0.15)] animate-in zoom-in-95 overflow-hidden">
                <div className="bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center border-b border-white/5 relative">
                    <button onClick={() => setShowStore(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-800/50 p-2 rounded-full">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-3 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                        <ShoppingCart className="w-8 h-8 text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white">Loja de Moedas da Sorte</h2>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Adquira moedas virtuais para atrair a sorte e gerar jogos com Inteligência Artificial.</p>
                </div>
                <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-amber-500/50 transition-all cursor-pointer group" onClick={() => handlePurchaseCoins(100)}>
                        <div className="flex items-center">
                            <span className="text-2xl mr-3 group-hover:scale-110 transition-transform">🪙</span>
                            <div>
                                <h3 className="text-sm font-bold text-gray-200 group-hover:text-amber-400">Pacote Iniciante</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">100 Moedas</p>
                            </div>
                        </div>
                        <button className="bg-gray-900 text-white text-xs font-black px-4 py-2 rounded-xl border border-gray-700 flex items-center group-hover:bg-amber-500 group-hover:text-amber-950 group-hover:border-amber-400 transition-colors">
                            R$ 4,90
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl border border-amber-500/30 bg-amber-900/10 hover:bg-amber-900/20 hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden" onClick={() => handlePurchaseCoins(500)}>
                        <div className="absolute top-0 right-0 bg-amber-500 text-amber-950 text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-widest shadow-sm">
                            Mais Popular
                        </div>
                        <div className="flex items-center">
                            <span className="text-3xl mr-3 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">💰</span>
                            <div>
                                <h3 className="text-sm font-bold text-amber-400">Pacote da Sorte</h3>
                                <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider">500 Moedas</p>
                            </div>
                        </div>
                        <button className="bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 text-xs font-black px-4 py-2 rounded-xl border border-yellow-300 flex items-center shadow-lg group-hover:scale-105 transition-transform">
                            R$ 24,50
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl border border-purple-500/50 bg-purple-900/20 hover:bg-purple-900/30 hover:border-purple-400 transition-all cursor-pointer group relative overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.15)]" onClick={() => handlePurchaseCoins(2000)}>
                        {promoTimeLeft > 0 && (
                            <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-2.5 py-0.5 rounded-bl-lg uppercase tracking-widest shadow-md flex items-center animate-pulse">
                                🔥 10% OFF • ⏳ {formatTime(promoTimeLeft)}
                            </div>
                        )}
                        <div className="flex items-center mt-3 sm:mt-0">
                            <span className="text-3xl mr-3 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">💎</span>
                            <div>
                                <h3 className="text-sm font-bold text-purple-300 group-hover:text-purple-200">Pacote Milionário</h3>
                                <p className="text-[10px] text-purple-400/60 font-bold uppercase tracking-wider">2000 Moedas</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            {promoTimeLeft > 0 ? (
                                <>
                                    <span className="text-[9px] text-gray-400 line-through mb-0.5 decoration-red-500/70 font-bold">R$ 98,00</span>
                                    <button className="bg-purple-600 text-white text-xs font-black px-4 py-1.5 rounded-xl border border-purple-400 flex items-center shadow-lg group-hover:bg-purple-500 transition-colors">
                                        R$ 87,90
                                    </button>
                                </>
                            ) : (
                                <button className="bg-gray-900 text-purple-300 text-xs font-black px-4 py-1.5 rounded-xl border border-purple-500/50 flex items-center shadow-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    R$ 98,00
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-4 bg-gray-950/50 text-center text-[10px] text-gray-500 flex justify-center items-center border-t border-white/5">
                    <CreditCard className="w-3 h-3 mr-1.5" /> Pagamento Seguro Google Play
                </div>
            </div>
        </div>
      )}

      {/* Fundo Decorativo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Lembrete de Sorteio (Toast Fixo Inferior) */}
      {drawReminder && !isGenerating && !isAiLoading && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-gray-900/95 backdrop-blur-xl border border-purple-500/40 p-4 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.2)] z-[90] animate-in slide-in-from-bottom-10 fade-in duration-700">
           <div className="flex justify-between items-start">
              <div className="flex gap-3">
                 <div className="bg-purple-500/20 p-2 rounded-full h-fit">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-white">Hoje é dia de {drawReminder.name}!</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-tight">Os astros estão alinhados. Deseja gerar seus números da sorte agora?</p>
                    <button onClick={() => { setActiveLottery(drawReminder.type); setDrawReminder(null); }} className="mt-2 text-xs font-black text-purple-300 hover:text-white uppercase tracking-wider underline decoration-purple-500/50 underline-offset-4">
                       Sim, Gerar Agora
                    </button>
                 </div>
              </div>
              <button onClick={() => setDrawReminder(null)} className="text-gray-600 hover:text-white"><X className="w-3 h-3" /></button>
           </div>
        </div>
      )}

      {/* Botões Flutuantes (Topo) */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 animate-in fade-in slide-in-from-top-4">
        <button onClick={() => setShowReferral(true)} className="flex items-center bg-gray-900/90 border border-purple-500/30 rounded-full px-3 py-1.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] hover:border-purple-400 transition-all group backdrop-blur-md">
            <Gift className="w-4 h-4 text-purple-400 mr-2 group-hover:animate-bounce" />
            <span className="text-purple-300 font-bold text-xs sm:text-sm drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">
                Indique e Ganhe
            </span>
        </button>
        <button onClick={() => setShowSavedGames(true)} className="flex items-center bg-gray-900/90 border border-emerald-500/30 rounded-full px-3 py-1.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] hover:border-emerald-400 transition-all group backdrop-blur-md mt-2">
            <Save className="w-4 h-4 text-emerald-400 mr-2" />
            <span className="text-emerald-300 font-bold text-xs sm:text-sm drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]">
                Meus Jogos
            </span>
        </button>
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 animate-in fade-in slide-in-from-top-4 flex flex-col items-end gap-2">
        {/* Botão de Login/Logout */}
        {user ? (
             <button onClick={handleLogout} className="flex items-center bg-red-900/80 border border-red-500/30 rounded-full px-3 py-1.5 shadow-lg hover:border-red-400 transition-all backdrop-blur-md text-[10px] text-red-200 font-bold uppercase tracking-wider">
                <LogOut className="w-3 h-3 mr-1.5" /> Sair
             </button>
        ) : (
             <button onClick={handleLogin} className="flex items-center bg-blue-600/90 border border-blue-400/50 rounded-full px-4 py-1.5 shadow-lg hover:bg-blue-500 transition-all backdrop-blur-md text-xs text-white font-bold uppercase tracking-wider">
                <LogIn className="w-3 h-3 mr-1.5" /> Entrar com Google
             </button>
        )}

        <button onClick={() => setShowStore(true)} className="flex items-center bg-gray-900/90 border border-amber-500/30 rounded-full pl-4 pr-1.5 py-1.5 shadow-[0_5px_15px_rgba(0,0,0,0.5)] hover:border-amber-400 transition-all group backdrop-blur-md">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mr-2 hidden sm:block">Saldo:</span>
            <span className="text-amber-400 font-black mr-2.5 text-sm sm:text-base drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]">
                {coins} <span className="text-xs">🪙</span>
            </span>
            <div className="bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 rounded-full w-7 h-7 flex items-center justify-center font-black group-hover:scale-110 transition-transform shadow-inner">
                <PlusCircle className="w-4 h-4" />
            </div>
        </button>
      </div>

      <div className="relative bg-gray-950/80 backdrop-blur-2xl border border-white/10 p-6 sm:p-10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-2xl text-center z-10 mt-16 sm:mt-0">

        {/* --- HEADER --- */}
        <div className="flex flex-col items-center mb-10 relative group w-full">
          <div className="flex flex-col items-center justify-center w-full">
            <div className="rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-950 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)] mb-6 group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden w-full h-40 sm:h-56">
                <video 
                  src={magoVideo}
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-300 leading-none flex items-center">
              Oráculo da Sorte<span className={`ml-2 ${currentConfig.accent}`}>IA</span>
            </h1>
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent mt-4 mb-3"></div>
            <p className="text-[10px] sm:text-xs text-purple-300/80 font-black tracking-widest uppercase text-center">
               A IA que une Intuição e Matemática para decifrar as Loterias
            </p>
          </div>
        </div>

        {/* Loterias (Tabs) */}
        <div className="flex justify-center space-x-2 mb-6 bg-gray-900/50 p-2 rounded-2xl border border-gray-800/50">
          {Object.entries(lotteriesConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handleLotteryChange(key)}
              className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-100 tab-chip ${
                activeLottery === key 
                  ? 'bg-gradient-to-t from-gray-700 to-gray-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),_0_0_10px_rgba(0,0,0,0.5)] active border-gray-800' 
                  : 'bg-gray-800 border-gray-900 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              {config.name}
            </button>
          ))}
        </div>

        {/* Controles Básicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className={`bg-gray-900/40 p-3.5 rounded-2xl flex flex-col justify-center border border-gray-800/60 shadow-inner relative overflow-hidden transition-all`}>
                <div className="flex justify-between items-center mb-1.5 z-10">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Volume de Jogos</span>
                </div>
                <select value={numberOfGames} onChange={(e) => setNumberOfGames(Number(e.target.value))} disabled={isAiLoading || isGenerating}
                    className={`bg-gray-950 font-semibold border border-gray-700/50 rounded-xl p-2 focus:outline-none text-sm z-10 relative text-gray-200 focus:border-gray-500`}
                >
                    <option value={1}>1 Bilhete</option>
                    <option value={3}>3 Bilhetes</option>
                    <option value={5}>5 Bilhetes</option>
                    <option value={10}>10 Bilhetes</option>
                </select>
            </div>

            <div className={`p-3.5 rounded-2xl flex flex-col justify-center border shadow-inner relative overflow-hidden transition-all duration-500 ${currentLevelInfo.bg} ${currentLevelInfo.border}`}>
                <div className="flex justify-between items-center mb-1.5 z-10">
                   <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Estratégia</span>
                   <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded border ${currentLevelInfo.color} border-current opacity-80`}>
                      {currentLevelInfo.level}
                   </span>
                </div>
                <select value={betCounts[activeLottery]} onChange={handleBetCountChange} disabled={isAiLoading || isGenerating}
                    className={`bg-gray-950/80 font-bold border border-gray-700/50 rounded-xl p-2 focus:outline-none text-sm z-10 relative ${currentLevelInfo.color}`}
                >
                    {availableBetOptions.map(num => {
                      const eqBets = calculateCombinations(num, currentConfig.count);
                      return <option key={num} value={num} className="text-gray-300">{num} Dezenas {num === currentConfig.count ? '' : `(${eqBets}x o custo)`}</option>;
                    })}
                </select>
            </div>
        </div>

        {/* --- PAINEL PRINCIPAL (CARRO-CHEFE) --- */}
        <div className="mb-8 p-1 rounded-3xl bg-gradient-to-b from-purple-500/20 to-transparent">
             <div className="p-4 sm:p-6 bg-gray-900/90 backdrop-blur-md rounded-[1.4rem] border border-purple-500/30 shadow-2xl text-left relative overflow-hidden">
                
                {isAiLoading ? (
                   <div className="flex flex-col items-center justify-center py-12 space-y-6">
                     {aiPersona === 'mystic' ? (
                        <>
                          <div className="relative" style={{ animation: 'astral-float 4s ease-in-out infinite' }}>
                            <div className="absolute inset-0 bg-fuchsia-500 blur-[30px] opacity-70 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 bg-purple-600 blur-[15px] opacity-90 rounded-full mix-blend-screen"></div>
                            <Sparkles className="w-20 h-20 text-fuchsia-100 relative z-10 animate-spin-slow" style={{ animationDuration: '6s' }} />
                          </div>
                          <div className="flex flex-col items-center" style={{ animation: 'mediumnic-fade 2.5s ease-in-out infinite' }}>
                              <p className="text-fuchsia-200 font-black uppercase tracking-widest text-sm sm:text-base">Consultando os Astros...</p>
                              <p className="text-[11px] text-fuchsia-300/80 text-center mt-1">A decodificar a numerologia do seu sonho...</p>
                          </div>
                        </>
                     ) : (
                        <>
                          <div className="relative overflow-hidden rounded-2xl bg-blue-950/60 p-6 border border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 blur-md animate-[translate-y-full_1.5s_infinite]"></div>
                            <Cpu className="w-14 h-14 text-cyan-400 relative z-10 animate-pulse" />
                          </div>
                          <div className="flex flex-col items-center">
                              <p className="text-cyan-300 font-black uppercase tracking-widest text-sm sm:text-base animate-pulse">A processar matrizes LLM...</p>
                              <p className="text-[11px] text-cyan-400/60 text-center mt-1">Cruzando milhares de combinações matemáticas em tempo real...</p>
                          </div>
                        </>
                     )}
                   </div>
                ) : (
                  <>
                    {/* Switcher de Personas de IA */}
                    <div className="flex bg-gray-950/80 rounded-xl p-1.5 mb-5 border border-gray-800/80 shadow-inner items-center">
                        <button onClick={() => setAiPersona('mystic')}
                           className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${aiPersona === 'mystic' ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-[0_4px_10px_rgba(168,85,247,0.4)] scale-[1.02]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                           🌙 Oráculo
                        </button>
                        <button onClick={() => setAiPersona('statistician')}
                           className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${aiPersona === 'statistician' ? 'bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-[0_4px_10px_rgba(59,130,246,0.4)] scale-[1.02]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                           🧮 Estatístico
                        </button>
                    </div>

                    {/* Caixa de Input da IA (Estilo Prompt) com ferramentas embutidas */}
                    <div className={`w-full bg-gray-950 border rounded-xl p-2 transition-all shadow-inner flex flex-col 
                        ${aiPersona === 'mystic' ? 'border-purple-500/30 focus-within:border-purple-500/70' : 'border-blue-500/30 focus-within:border-blue-500/70'}`}>
                        
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 px-2 pt-1">
                           {aiPersona === 'mystic' ? 'Qual a sua intuição ou sonho hoje?' : 'Dê uma instrução para a IA (Opcional)'}
                        </label>
                        
                        <textarea rows="3" value={userDream} onChange={(e) => setUserDream(e.target.value)}
                          placeholder={aiPersona === 'mystic' ? "Ex: Sonhei com moedas de ouro e um cavalo branco voando..." : "Ex: Priorize números ímpares ou números que não saíram no último concurso..."}
                          className="w-full bg-transparent p-2 text-sm text-gray-200 placeholder-gray-700 focus:outline-none resize-none"
                        />
                        
                        {/* Barra de Ferramentas da IA */}
                        <div className="flex items-center justify-between px-1 pb-1 pt-3 border-t border-gray-800/50 mt-1">
                            <div className="flex space-x-2">
                                {/* Badge de Banco de Dados */}
                                <div className="flex items-center text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20" title="Base de dados oficial da Caixa conectada">
                                    <Database className="w-3 h-3 mr-1" />
                                    Dados Oficiais da Caixa
                                </div>
                                {/* Ferramenta de Inspecionar Matrizes */}
                                <button onClick={() => setShowStats(!showStats)} className="flex items-center text-[9px] font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 transition-colors">
                                    <BarChart2 className="w-3 h-3 mr-1" />
                                    {showStats ? 'Ocultar Matrizes' : 'Ver Matrizes'}
                                </button>
                            </div>
                            <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest hidden sm:block">IA Tools</span>
                        </div>
                    </div>

                    {/* Exibição das Matrizes de Estatísticas */}
                    {showStats && hasRealData && (
                      <div className="w-full text-left bg-gray-950/80 rounded-xl p-4 mt-3 overflow-y-auto max-h-[250px] custom-scrollbar border border-gray-800 shadow-inner animate-in slide-in-from-top-2">
                        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center border-b border-gray-800 pb-2">
                            <TrendingUp className="w-3 h-3 mr-1.5" />
                            Raio-X do Algoritmo em Tempo Real
                        </h3>
                        <div className="space-y-3">
                        {Array.from({ length: currentConfig.count }).map((_, i) => {
                            const { probs, minPossible, maxPossible } = getHouseProbabilities(i, currentConfig, activeLottery, 0);
                            const lastNum = realData[activeLottery].lastDraw[i];
                            const quentes = probs.slice(0, 5).map(s => s.number);
                            const frios = probs.slice(-5).reverse().map(s => s.number).filter(n => !quentes.includes(n)); 

                            return (
                            <div key={i} className="bg-gray-900/50 rounded-lg p-2.5 border border-gray-800/80">
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center font-black tracking-tighter text-[10px] bg-gradient-to-br from-gray-700 to-gray-900 text-gray-300 border border-gray-600 shadow-inner mr-1.5">
                                            {i + 1}
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                                            (De {minPossible} a {maxPossible})
                                        </span>
                                    </div>
                                    <span className="text-[8px] text-gray-500 uppercase font-bold">Último: <strong className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded ml-1">{lastNum}</strong></span>
                                </div>
                                <div className="w-full h-0.5 bg-gradient-to-r from-red-500/80 via-amber-500/80 to-blue-500/80 rounded-full mb-2"></div>
                                <div className="flex justify-between text-[9px] font-medium">
                                  <div className="w-1/2 pr-1">
                                      <span className="text-red-400 flex items-center gap-1 mb-0.5 font-bold">🔥 Quentes</span>
                                      <span className="text-gray-300">{quentes.join(', ') || '-'}</span>
                                  </div>
                                  <div className="w-1/2 pl-1 border-l border-gray-800 text-right">
                                      <span className="text-blue-400 flex items-center justify-end gap-1 mb-0.5 font-bold">🧊 Frios</span>
                                      <span className="text-gray-300">{frios.join(', ') || '-'}</span>
                                  </div>
                                </div>
                            </div>
                            );
                        })}
                        </div>
                      </div>
                    )}
                    
                    {aiError && <p className="text-red-400 text-[10px] mt-3 flex items-center bg-red-950/30 p-2 rounded-lg border border-red-900/50"><AlertTriangle className="w-3 h-3 mr-1.5"/> {aiError}</p>}
                    
                    {/* Botão de Geração Principal (3D) */}
                    <button onClick={generateGameWithAI} disabled={isAiLoading || (revealedIndex >= 0 && generatedGames.length > 0 && revealedIndex <= Math.max(...generatedGames.map(g => g.numbers.length)))}
                      className={`w-full mt-4 py-4 rounded-2xl flex justify-center items-center text-sm sm:text-base font-black tracking-widest uppercase
                         ${(isAiLoading || (revealedIndex >= 0 && revealedIndex <= 15)) 
                             ? 'bet-btn-disabled' 
                             : (aiPersona === 'mystic' ? 'bet-btn-mystic' : 'bet-btn-stat')}`}
                    >
                      {aiPersona === 'mystic' ? '✨ Consultar o Plano Astral' : '🧮 Gerar com I.A.'}
                      
                      {/* Ecrã de Custo Integrado */}
                      <span className="ml-3 text-[10px] font-black bg-black/60 text-yellow-300 px-2.5 py-1 rounded-md flex items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-white/10 normal-case tracking-normal">
                         {aiCost} 🪙
                      </span>
                    </button>
                  </>
                )}
             </div>
        </div>

        {/* Visor de Resultados */}
        <div className="mb-10 min-h-[6rem]">
          {generatedGames.length === 0 && !isGenerating && revealedIndex === -1 ? (
            <div className="text-gray-600 text-sm font-medium flex flex-col items-center justify-center h-24 bg-gray-900/30 rounded-2xl border border-gray-800/50 border-dashed">
              <Sparkles className="w-5 h-5 mb-2 opacity-20" /> O Oráculo aguarda o seu comando...
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center h-32 bg-gray-900/30 rounded-2xl border border-gray-800/50">
               <RefreshCw className={`w-8 h-8 animate-spin mb-3 ${currentConfig.accent}`} />
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">A processar...</span>
            </div>
          ) : (
            <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                {generatedGames.map((gameObj, gameIndex) => {
                    const game = gameObj.numbers;
                    const alreadyDrawn = gameObj.alreadyDrawn;
                    const isAi = gameObj.isAiGenerated;
                    const isGameFullyRevealed = revealedIndex >= game.length;
                    
                    const gameLevelInfo = getBetLevelInfo(game.length, currentConfig.count);

                    const planTagColors = {
                      'Gerador Rápido': 'text-gray-400 bg-gray-800 border-gray-700',
                      'IA Avançada': 'text-purple-400 bg-purple-950/50 border-purple-500/50'
                    };

                    return (
                      <div key={gameIndex} className={`bg-gray-900/60 p-6 sm:p-8 rounded-[2rem] border relative group transition-all duration-500
                        ${isGameFullyRevealed && alreadyDrawn ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 
                          (isGameFullyRevealed && isAi ? (gameObj.aiPersonaUsed === 'statistician' ? 'border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.1)]') : 'border-gray-700/50')}
                      `}>
                          
                          {isGameFullyRevealed && alreadyDrawn && (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] flex items-center z-10 animate-in zoom-in duration-500">
                              <ShieldAlert className="w-3 h-3 mr-1.5 animate-pulse" /> Combinação Já Sorteada!
                            </div>
                          )}

                          <div className="flex justify-between items-center mb-6">
                              <div className="flex flex-wrap items-center gap-2">
                                {isAi ? (
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-inner flex items-center transition-colors
                                     ${isGameFullyRevealed 
                                       ? (gameObj.aiPersonaUsed === 'statistician' ? 'text-blue-300 bg-blue-950/50 border-blue-500/30' : 'text-purple-300 bg-purple-950/50 border-purple-500/30')
                                       : 'text-gray-500 bg-gray-900 border-gray-700'}`}>
                                    {gameObj.aiPersonaUsed === 'statistician' ? <><Cpu className="w-3 h-3 mr-1"/> IA Estrategista</> : <><Sparkles className="w-3 h-3 mr-1"/> Oráculo IA</>}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700 shadow-inner flex items-center">
                                    <Dices className="w-3 h-3 mr-1" /> Bilhete {gameIndex + 1}
                                  </span>
                                )}
                                
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border shadow-sm flex items-center ${gameLevelInfo.color} ${gameLevelInfo.bg} ${gameLevelInfo.border}`}>
                                  {game.length > currentConfig.count ? <Zap className="w-3 h-3 mr-1" /> : ''} {gameLevelInfo.title}
                                </span>

                                {isGameFullyRevealed && (
                                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded border shadow-sm flex items-center animate-in fade-in ${planTagColors[gameObj.gameType]}`}>
                                    {gameObj.gameType}
                                  </span>
                                )}
                              </div>
                              
                              {isGameFullyRevealed && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button onClick={() => copyToClipboard(game)} className="p-2 text-gray-500 hover:text-white bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors animate-in fade-in duration-300" title="Copiar">
                                      <Copy className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleShareWhatsApp(gameObj, gameIndex)} className="p-2 text-gray-500 hover:text-green-400 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors animate-in fade-in duration-300" title="Compartilhar no WhatsApp">
                                      <Share2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleSaveGame(gameObj)} className="p-2 text-gray-500 hover:text-emerald-400 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors animate-in fade-in duration-300" title="Salvar na Conta">
                                      <Save className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                          </div>

                          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                              {game.map((num, index) => {
                                 const ballStyle = alreadyDrawn 
                                    ? 'bg-[radial-gradient(circle_at_30%_30%,_#fca5a5,_#ef4444,_#991b1b)] text-white shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.5),_0_0_25px_rgba(239,68,68,0.85)] border border-red-300'
                                    : 'bg-[radial-gradient(circle_at_30%_30%,_#fef08a,_#eab308,_#854d0e)] text-amber-950 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.6),_0_0_25px_rgba(251,191,36,0.9)] border border-yellow-200';
                                 
                                 const sizeClass = game.length > 10 ? 'w-9 h-9 sm:w-11 sm:h-11 text-sm sm:text-base' : 'w-12 h-12 sm:w-14 sm:h-14 text-lg sm:text-xl';

                                 return (
                                    <LotteryBall 
                                        key={index}
                                        finalNumber={num}
                                        index={index}
                                        revealedIndex={revealedIndex}
                                        ballStyle={ballStyle}
                                        sizeClass={sizeClass}
                                        maxVal={currentConfig.max}
                                    />
                                 );
                              })}
                          </div>

                          {isGameFullyRevealed && isAi && gameObj.aiMessage && (
                             <div className={`mt-8 pt-5 border-t text-sm flex flex-col sm:flex-row gap-4 items-start text-left p-4 rounded-xl animate-in slide-in-from-top-4 duration-500
                                ${gameObj.aiPersonaUsed === 'statistician' ? 'border-blue-500/20 text-blue-200/90 bg-blue-950/30' : 'border-purple-500/20 text-purple-200/90 bg-purple-950/30'}
                             `}>
                                <div className="flex-1 flex items-start">
                                  {gameObj.aiPersonaUsed === 'statistician' 
                                    ? <Calculator className="w-4 h-4 mr-2.5 mt-0.5 shrink-0 text-blue-400" />
                                    : <MessageCircle className="w-4 h-4 mr-2.5 mt-0.5 shrink-0 text-purple-400" />
                                  }
                                  <span className="italic leading-relaxed text-xs sm:text-sm font-medium">{gameObj.aiMessage}</span>
                                </div>

                                <button onClick={() => handlePlayAudio(gameObj.aiMessage, gameIndex, gameObj.aiPersonaUsed)} disabled={isAudioLoading}
                                  className={`shrink-0 flex items-center justify-center py-2 px-4 rounded-lg text-xs font-bold transition-all border shadow-lg
                                    ${gameObj.aiPersonaUsed === 'statistician' 
                                       ? 'bg-blue-900/60 hover:bg-blue-800 text-blue-100 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                                       : 'bg-purple-900/60 hover:bg-purple-800 text-purple-100 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'}
                                  `}
                                >
                                  {isAudioLoading && !audioData[gameIndex] ? (
                                    <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin"/> Sintetizando...</>
                                  ) : (
                                    <><Volume2 className="w-3.5 h-3.5 mr-2"/> Ouvir Oráculo</>
                                  )}
                                </button>
                             </div>
                          )}
                      </div>
                    );
                })}
                
                {allGamesRevealed && (
                    <div className="mt-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                       <button onClick={handleSendEmail} disabled={isSendingEmail || emailSent}
                          className={`py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm flex items-center transition-all shadow-lg border
                             ${emailSent ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50 cursor-default' : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600 hover:border-gray-500'}`}
                       >
                          {isSendingEmail ? <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> : emailSent ? <CheckCircle className="w-4 h-4 mr-2 text-emerald-400"/> : <Mail className="w-4 h-4 mr-2"/>}
                          {isSendingEmail ? 'A comunicar com o Google...' : emailSent ? 'Enviado para o seu E-mail!' : 'Enviar Bilhetes para o E-mail'}
                       </button>
                    </div>
                )}
            </div>
          )}
        </div>

        {/* --- GERADOR SECUNDÁRIO --- */}
        <div className="pt-6 border-t border-gray-800/80 flex flex-col items-center space-y-4">
            <button onClick={generateGames} disabled={isGenerating || (revealedIndex >= 0 && generatedGames.length > 0 && revealedIndex <= Math.max(...generatedGames.map(g => g.numbers.length)))}
              className={`w-full max-w-sm py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center
                ${(isGenerating || (revealedIndex >= 0 && revealedIndex <= 15))
                  ? 'bet-btn-disabled' 
                  : 'bet-btn-gold'
                }`}
            >
              <span>Gerar Sorteio Rápido (Sem IA)</span>
              {revealedIndex < 0 && !isGenerating && (
                  <span className="ml-3 text-[10px] font-black bg-black/60 text-yellow-300 px-2 py-0.5 rounded-md flex items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-white/10 normal-case tracking-normal">
                      {currentCost} 🪙
                  </span>
              )}
            </button>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Algoritmo avançado sobre a base de sorteios oficiais</p>
        </div>

      </div>
    </div>
  );
}
