'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import type { User, ChessPiece, Board, Position, PieceType, PlayerColor, Currency } from '@/lib/types';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    Loader2, Crown, Users, Bot, Swords, RefreshCcw, 
    BrainCircuit, ArrowLeft, Trophy, Gamepad2, Plus, 
    ArrowRightLeft, Clock, Power, Copy, Pause, Play, 
    Handshake, Check, X, History, ChevronRight, ShieldCheck 
} from 'lucide-react';
import { 
    createChessGame, joinChessGame, getGameState, 
    makeMove, forfeitGame, resolveChessGame, 
    proposeDraw, respondToDraw, getOpenInvitations, getPlayerMatchHistory 
} from '@/lib/actions/game.actions';
import { ChessLogic } from '@/lib/chess-logic';
import Image from 'next/image';
import { useAudio } from '@/hooks/use-audio';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const pieceImagePaths: Record<PlayerColor, Record<PieceType, string>> = {
  white: {
    pawn: '/images/chess/pawn-white.png',
    rook: '/images/chess/rook-white.png',
    knight: '/images/chess/knight-white.png',
    bishop: '/images/chess/bishop-white.png',
    queen: '/images/chess/queen-white.png',
    king: '/images/chess/king-white.png',
  },
  black: {
    pawn: '/images/chess/pawn-black.png',
    rook: '/images/chess/rook-black.png',
    knight: '/images/chess/knight-black.png',
    bishop: '/images/chess/bishop-black.png',
    queen: '/images/chess/queen-black.png',
    king: '/images/chess/king-black.png',
  },
};

const ChessPieceIcon = ({ piece }: { piece: ChessPiece }) => {
  const imagePath = pieceImagePaths[piece.color][piece.type];
  return <Image src={imagePath} alt={`${piece.color} ${piece.type}`} width={40} height={40} className="h-8 w-8 md:h-10 md:w-10 drop-shadow-md" />;
};

type GameState = 'mode-select' | 'level-select' | 'invite-type' | 'create-invite' | 'join-invite' | 'waiting' | 'in-game' | 'game-over';
type GameMode = 'ai' | 'player';

const createGameSchema = z.object({
  betAmount: z.coerce.number().min(100, { message: "Mise minimale 100." }),
  currency: z.string({required_error: "Devise requise."}),
});

const joinGameSchema = z.object({
  gameCode: z.string().min(4, { message: "Code requis." }),
});

export function ChessClient({ user }: { user: User }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    const [gameState, setGameState] = useState<GameState>('mode-select');
    const [gameId, setGameId] = useState<number | null>(null);
    const [gameData, setGameData] = useState<any>(null);
    const [gameMode, setGameMode] = useState<GameMode | null>(null);
    const [difficultyLevel, setDifficultyLevel] = useState<number>(1);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [chessLogic, setChessLogic] = useState(() => new ChessLogic());
    
    const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [betAmount, setBetAmount] = useState(0);
    const [betCurrency, setBetCurrency] = useState('CDF');
    const [opponent, setOpponent] = useState<any>({ full_name: 'Ordinateur', profile_photo: '/avatars/robot.png' });
    const [showPromotionDialog, setShowPromotionDialog] = useState(false);
    const [promotionMove, setPromotionMove] = useState<{ from: Position; to: Position } | null>(null);
    const [userColor, setUserColor] = useState<PlayerColor>('white');
    
    // UI States
    const [openInvitations, setOpenInvitations] = useState<any[]>([]);
    const [matchHistory, setMatchHistory] = useState<any[]>([]);
    const [isLoadingUI, setIsLoadingUI] = useState(false);

    // Timers
    const [moveTime, setMoveTime] = useState(60);
    const [isPaused, setIsPaused] = useState(false);
    const [pauseTimeLeft, setPauseTimeLeft] = useState(0);
    const [hasUsedPause, setHasUsedPause] = useState(false);
    
    // Draw Proposal State
    const [drawProposedBy, setDrawProposedBy] = useState<number | null>(null);
    const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);

    const [winner, setWinner] = useState<PlayerColor | null>(null);
    const [winnerName, setWinnerName] = useState<string | null>(null);
    const [isDraw, setIsDraw] = useState(false);

    const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);

    const { play: playMove } = useAudio('/sounds/chess/chess-move.wav');
    const { play: playCapture } = useAudio('/sounds/chess/captured-sound.wav');
    const { play: playCheck } = useAudio('/sounds/chess/king-touch.mp3');
    const { play: playVictory } = useAudio('/sounds/chess/victory.wav');
    const { play: playDefeat } = useAudio('/sounds/chess/defeat.wav');
    const { play: playTimeout } = useAudio('/sounds/chess/timeout.wav');
    
    const createGameForm = useForm<z.infer<typeof createGameSchema>>({
        resolver: zodResolver(createGameSchema),
        defaultValues: { betAmount: 1000, currency: 'CDF'},
    });
    
    const joinGameForm = useForm<z.infer<typeof joinGameSchema>>({
        resolver: zodResolver(joinGameSchema),
        defaultValues: { gameCode: '' },
    });

    const isCheck = chessLogic.isCheck(chessLogic.turn);
    const isCheckmate = chessLogic.isCheckmate(chessLogic.turn);
    const isStalemate = chessLogic.isStalemate(chessLogic.turn);

    useEffect(() => {
      getUserCurrencies(user.id).then(setUserCurrencies);
    }, [user.id]);

    const refreshLobby = useCallback(async () => {
        setIsLoadingUI(true);
        const [invites, history] = await Promise.all([
            getOpenInvitations(),
            getPlayerMatchHistory(user.id)
        ]);
        setOpenInvitations(invites);
        setMatchHistory(history);
        setIsLoadingUI(false);
    }, [user.id]);

    useEffect(() => {
        if (gameState === 'mode-select' || gameState === 'invite-type') {
            refreshLobby();
        }
    }, [gameState, refreshLobby]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((gameState === 'waiting' || gameState === 'in-game') && gameId) {
            interval = setInterval(async () => {
                const state = await getGameState(gameId);
                if (state) {
                    setGameData(state.fullGame);
                    if (state.fen !== chessLogic.getFen()) {
                        setChessLogic(new ChessLogic(undefined, state.fen));
                        setMoveTime(60);
                    }
                    if (state.drawProposedBy && state.drawProposedBy !== user.id) {
                        setDrawProposedBy(state.drawProposedBy);
                        setIsDrawModalOpen(true);
                    } else if (!state.drawProposedBy) {
                        setDrawProposedBy(null);
                        setIsDrawModalOpen(false);
                    }
                    if (state.status === 'active' && gameState === 'waiting') {
                        setGameState('in-game');
                        setOpponent(state.fullGame.player1_id === user.id ? { id: state.fullGame.player2_id, full_name: state.p2_name } : { id: state.fullGame.player1_id, full_name: state.p1_name });
                    }
                    if (state.status === 'completed') {
                        setGameState('game-over');
                        if (state.winnerId) {
                             const winColor = state.winnerId === state.fullGame.player1_id ? state.fullGame.player1_color : (state.fullGame.player1_color === 'white' ? 'black' : 'white');
                             setWinner(winColor);
                             setWinnerName(state.winnerId === state.fullGame.player1_id ? state.p1_name : state.p2_name);
                        } else {
                            setIsDraw(true);
                        }
                    }
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [gameState, gameId, chessLogic, user.id]);

    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (gameState === 'in-game' && !isPaused) {
        timer = setInterval(() => {
          setMoveTime(t => {
              if (t <= 1) {
                  clearInterval(timer);
                  handleTimeout();
                  return 0;
              }
              return t - 1;
          });
        }, 1000);
      } else if (isPaused && pauseTimeLeft > 0) {
          timer = setInterval(() => {
              setPauseTimeLeft(t => {
                  if (t <= 1) {
                      setIsPaused(false);
                      return 0;
                  }
                  return t - 1;
              });
          }, 1000);
      }
      return () => clearInterval(timer);
    }, [gameState, isPaused, pauseTimeLeft]);

    const handleTimeout = useCallback(async () => {
        if (gameState !== 'in-game' || !gameId) return;
        playTimeout();
        const loserId = (chessLogic.turn === userColor) ? user.id : opponent.id;
        if (gameMode === 'player') {
            await forfeitGame(gameId, loserId);
        }
        setGameState('game-over');
    }, [gameState, gameId, chessLogic.turn, userColor, user.id, opponent.id, gameMode, playTimeout]);

    const handleProposeDraw = async () => {
        if (!gameId) return;
        const result = await proposeDraw(gameId, user.id);
        if (result.success) {
            toast({ title: t('chessDrawProposed'), description: t('chessDrawProposedDesc') });
            setDrawProposedBy(user.id);
        } else {
            openAlert({ title: t('error'), description: result.error || "Impossible de proposer un nul.", variant: 'error' });
        }
    }

    const handleRespondToDraw = async (accept: boolean) => {
        if (!gameId) return;
        const result = await respondToDraw(gameId, accept);
        if (result.success) {
            if (accept) {
                toast({ title: t('chessDrawTitle'), description: t('chessDrawDesc') });
            } else {
                toast({ title: t('chessRefuse'), description: "Demande refusée." });
            }
            setIsDrawModalOpen(false);
            setDrawProposedBy(null);
        }
    }

    const handlePauseRequest = () => {
        if (hasUsedPause || gameState !== 'in-game') return;
        openAlert({
            title: t('chessPause'),
            description: "Activer votre pause de 60 secondes ?",
            showCancel: true,
            onClose: (confirmed) => {
                if (confirmed) {
                    setIsPaused(true);
                    setPauseTimeLeft(60);
                    setHasUsedPause(true);
                }
            }
        });
    };

    const resetGame = useCallback(() => {
        setChessLogic(new ChessLogic());
        setSelectedPiece(null);
        setValidMoves([]);
        setGameState('mode-select');
        setGameMode(null);
        setBetAmount(0);
        setGameCode(null);
        setGameId(null);
        setMoveTime(60);
        setWinner(null);
        setWinnerName(null);
        setIsDraw(false);
        setIsPaused(false);
        setHasUsedPause(false);
        setDrawProposedBy(null);
        setIsDrawModalOpen(false);
    }, []);
    
    const handleQuitGame = () => {
        if(gameState !== 'in-game' || !gameId) {
            resetGame();
            return;
        }
        openAlert({
            title: t('chessAbandon'),
            description: "Voulez-vous abandonner ? La mise sera perdue.",
            variant: 'warning',
            showCancel: true,
            onClose: (confirmed) => {
                if(confirmed && gameId) {
                    forfeitGame(gameId, user.id);
                    setGameState('game-over');
                }
            }
        });
    }

    const handleCellClick = useCallback(async (row: number, col: number) => {
        if (gameState !== 'in-game' || isPaused || isAiThinking) return;
        const turn = chessLogic.turn;
        if (gameMode === 'ai' && turn === 'black') return;
        if (gameMode === 'player' && userColor !== turn) return;

        if (selectedPiece) {
            const isValid = validMoves.some(m => m.row === row && m.col === col);
            if (isValid) {
                const move = { from: selectedPiece, to: { row, col } };
                const piece = chessLogic.board[selectedPiece.row][selectedPiece.col];
                if (piece?.type === 'pawn' && (row === 0 || row === 7)) {
                    setPromotionMove(move);
                    setShowPromotionDialog(true);
                } else {
                    const isCapture = !!chessLogic.board[row][col];
                    chessLogic.movePiece(move.from, move.to);
                    if (gameId) {
                        await makeMove(gameId, move, chessLogic.getFen());
                        if (chessLogic.isCheckmate(chessLogic.turn)) await resolveChessGame(gameId, user.id);
                    }
                    setChessLogic(new ChessLogic(chessLogic));
                    isCapture ? playCapture() : playMove();
                    if (chessLogic.isCheck(chessLogic.turn)) playCheck();
                    setMoveTime(60);
                }
            }
            setSelectedPiece(null);
            setValidMoves([]);
        } else {
            const piece = chessLogic.board[row][col];
            if (piece && piece.color === turn) {
                setSelectedPiece({ row, col });
                setValidMoves(chessLogic.getValidMovesForPiece({ row, col }));
            }
        }
    }, [chessLogic, selectedPiece, validMoves, gameState, isPaused, isAiThinking, gameMode, userColor, playMove, playCapture, playCheck, gameId, user.id]);

    const handlePromotion = async (pieceType: PieceType) => {
        if (promotionMove) {
            playMove();
            chessLogic.movePiece(promotionMove.from, promotionMove.to, pieceType);
            if (gameId) {
                await makeMove(gameId, promotionMove, chessLogic.getFen(), pieceType);
                if (chessLogic.isCheckmate(chessLogic.turn)) await resolveChessGame(gameId, user.id);
            }
            setChessLogic(new ChessLogic(chessLogic));
            setMoveTime(60);
        }
        setShowPromotionDialog(false);
        setPromotionMove(null);
    };

    const handleModeSelect = (mode: GameMode) => {
        setGameMode(mode);
        if (mode === 'ai') {
            setGameState('level-select');
        } else {
            setGameState('invite-type');
        }
    };

    const handleCreateGameSubmit = async (values: z.infer<typeof createGameSchema>) => {
        setIsLoadingUI(true);
        const result = await createChessGame(user, values.betAmount, values.currency);
        if (result.success) {
            setGameId(result.gameId!);
            setGameCode(result.gameCode!);
            setBetAmount(values.betAmount);
            setBetCurrency(values.currency);
            setUserColor(result.playerColor!);
            setGameState('waiting');
        } else {
            openAlert({ title: t('error'), description: result.error || "Échec de la création.", variant: 'error' });
        }
        setIsLoadingUI(false);
    };

    const handleJoinGameSubmit = async (values: z.infer<typeof joinGameSchema>) => {
        setIsLoadingUI(true);
        const result = await joinChessGame(user, values.gameCode);
        if (result.success) {
            setGameId(result.gameId!);
            setBetAmount(result.betAmount!);
            setBetCurrency(result.currency!);
            setUserColor(result.playerColor!);
            setOpponent(result.opponent);
            setGameState('in-game');
        } else {
            openAlert({ title: t('error'), description: result.error || "Impossible de rejoindre.", variant: 'error' });
        }
        setIsLoadingUI(false);
    };

    const chessboardRows = userColor === 'white' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];

    const PlayerInfo = ({ player, isTurn, timeLeft }: { player: any, isTurn: boolean, timeLeft: number }) => (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-xl transition-all border-2",
            isTurn ? "bg-primary/10 border-primary shadow-lg scale-105" : "bg-zinc-800/50 border-transparent opacity-80"
        )}>
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-background">
                    <AvatarImage src={player.profile_photo || ''} />
                    <AvatarFallback className="bg-zinc-700 text-white font-bold">{player.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-black text-sm text-white">{player.full_name}</p>
                    {isTurn && <Badge variant="secondary" className="h-4 text-[8px] bg-primary text-white uppercase">{t('chessYourTurn')}</Badge>}
                </div>
            </div>
            <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-black text-xl",
                isTurn ? (timeLeft < 10 ? "bg-red-600 text-white animate-pulse" : "bg-primary text-white") : "bg-zinc-900 text-zinc-500"
            )}>
                <Clock className="h-4 w-4" />
                {timeLeft}s
            </div>
        </div>
    );

    const GameOverDialog = () => {
        if (gameState !== 'game-over') return null;
        const isWinner = winner === userColor;
        useEffect(() => { if (!isDraw) isWinner ? playVictory() : playDefeat(); }, [isWinner]);

        return (
            <Dialog open={true} onOpenChange={() => resetGame()}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white text-center sm:max-w-md">
                    <div className="py-6 space-y-6">
                        {isDraw ? (
                             <div className="space-y-4">
                                <div className="h-32 w-32 bg-zinc-700 rounded-full flex items-center justify-center mx-auto"><Handshake className="h-16 w-16 text-zinc-300" /></div>
                                <h2 className="text-3xl font-black text-zinc-300">{t('chessDrawTitle')}</h2>
                                <p className="text-lg">{t('chessDrawDesc')}</p>
                                {betAmount > 0 && (
                                    <div className="p-4 bg-zinc-800 rounded-xl border border-zinc-700">
                                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{t('chessRefunded')}</p>
                                        <p className="text-2xl font-black text-white">{ betAmount.toLocaleString() } {betCurrency}</p>
                                    </div>
                                )}
                            </div>
                        ) : isWinner ? (
                            <div className="space-y-4">
                                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="h-32 w-32 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto"><Trophy className="h-16 w-16 text-yellow-400" /></motion.div>
                                <h2 className="text-3xl font-black text-yellow-400">{t('chessVictoryTitle')}</h2>
                                <p className="text-lg">{t('chessVictoryDesc')}</p>
                                {betAmount > 0 && (
                                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                        <p className="text-xs text-green-400 font-bold uppercase tracking-widest">{t('chessGainsCollected')}</p>
                                        <p className="text-2xl font-black text-white">{ (betAmount * 2).toLocaleString() } {betCurrency}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="h-32 w-32 bg-red-500/10 rounded-full flex items-center justify-center mx-auto"><Swords className="h-16 w-16 text-red-500" /></div>
                                <h2 className="text-3xl font-black text-red-500">{t('chessDefeatTitle')}</h2>
                                <p className="text-lg">{t('chessDefeatDesc')}</p>
                                <p className="text-zinc-400 font-bold">{winnerName} {t('chessWinnerPrefix')}</p>
                            </div>
                        )}
                        <div className="flex flex-col gap-2 pt-4">
                            <Button onClick={resetGame} variant="gradient" className="h-12 font-bold text-lg">{t('backButton')}</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    return (
        <div className="max-w-6xl mx-auto p-4 flex flex-col gap-6 lg:flex-row">
            <GameOverDialog />
            <Dialog open={isDrawModalOpen} onOpenChange={(open) => !open && handleRespondToDraw(false)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white text-center">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 justify-center"><Handshake className="text-primary"/> {t('chessDrawRespondTitle')}</DialogTitle>
                        <DialogDescription className="text-zinc-400">{t('chessDrawRespondDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-4 pt-4">
                        <Button variant="outline" className="flex-1 border-zinc-700" onClick={() => handleRespondToDraw(false)}><X className="mr-2"/> {t('chessRefuse')}</Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleRespondToDraw(true)}><Check className="mr-2"/> {t('chessAccept')}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex-1 space-y-4 order-2 lg:order-1">
                {gameState === 'mode-select' && (
                    <div className="space-y-6">
                        <Card className="bg-zinc-800 border-zinc-700 text-white">
                            <CardHeader className="text-center">
                                <BrainCircuit className="h-12 w-12 text-primary mx-auto mb-2"/>
                                <CardTitle className="text-2xl font-black">{t('chessTitle')}</CardTitle>
                                <CardDescription>{t('chessSubTitle')}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Button className="h-32 flex-col gap-3 text-lg font-bold" onClick={() => handleModeSelect('ai')}>
                                    <Bot className="h-8 w-8" /> {t('chessPlayAi')}
                                </Button>
                                <Button className="h-32 flex-col gap-3 text-lg font-bold" variant="secondary" onClick={() => handleModeSelect('player')}>
                                    <Users className="h-8 w-8" /> {t('chessPlayFriend')}
                                </Button>
                            </CardContent>
                        </Card>
                        <Tabs defaultValue="invites" className="w-full">
                            <TabsList className="bg-zinc-800 w-full justify-start p-1 h-12">
                                <TabsTrigger value="invites" className="flex items-center gap-2 px-6 h-full font-bold uppercase text-xs"><Gamepad2 className="h-4 w-4"/> {t('chessLobbyTab')}</TabsTrigger>
                                <TabsTrigger value="history" className="flex items-center gap-2 px-6 h-full font-bold uppercase text-xs"><History className="h-4 w-4"/> {t('chessHistoryTab')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value="invites" className="pt-4">
                                <div className="grid gap-3">
                                    {isLoadingUI ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></div> :
                                     openInvitations.length > 0 ? openInvitations.map(inv => (
                                        <Card key={inv.id} className="bg-zinc-800 border-zinc-700 text-white">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <Avatar><AvatarImage src={inv.creator_photo}/><AvatarFallback>{inv.creator_name[0]}</AvatarFallback></Avatar>
                                                    <div>
                                                        <p className="font-bold text-sm">{inv.creator_name}</p>
                                                        <p className="text-xs text-primary font-black">{inv.bet_amount} {inv.currency}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="gradient" onClick={() => handleJoinGameSubmit({ gameCode: inv.game_code })}>REJOINDRE</Button>
                                            </CardContent>
                                        </Card>
                                    )) : <p className="text-center text-zinc-500 py-10">{t('chessNoInvites')}</p>}
                                </div>
                            </TabsContent>
                            <TabsContent value="history" className="pt-4">
                                <div className="grid gap-3">
                                    {isLoadingUI ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></div> :
                                     matchHistory.length > 0 ? matchHistory.map(m => (
                                        <Card key={m.id} className="bg-zinc-800 border-zinc-700 text-white">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase mb-1">
                                                        <span className="font-mono text-primary">#{m.game_code}</span>
                                                        <span>•</span>
                                                        <span>{format(new Date(m.created_at), 'dd MMM yyyy', { locale: fr })}</span>
                                                    </div>
                                                    <p className="text-sm font-bold truncate">{m.p1_name} vs {m.p2_name || '???'}</p>
                                                    <p className="text-xs text-zinc-400 mt-1">{t('chessBetAmount')}: {m.bet_amount} {m.currency}</p>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <Badge className={cn("text-[10px] font-black uppercase", m.winner_id === user.id ? "bg-green-600" : (m.winner_id === null ? "bg-zinc-600" : "bg-red-600"))}>
                                                        {m.winner_id === user.id ? 'Gagné' : (m.winner_id === null ? 'Nul' : 'Perdu')}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )) : <p className="text-center text-zinc-500 py-10">{t('chessNoHistory')}</p>}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                {gameState === 'level-select' && (
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardHeader>
                            <Button variant="ghost" size="icon" onClick={() => setGameState('mode-select')}><ArrowLeft/></Button>
                            <CardTitle>{t('chessDifficultyLevel')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="text-center"><p className="text-5xl font-black text-primary">{difficultyLevel}</p><p className="text-xs text-zinc-400 uppercase font-bold">{t('chessLevel')}</p></div>
                            <Input type="range" min="1" max="10" value={difficultyLevel} onChange={(e) => setDifficultyLevel(Number(e.target.value))} />
                            <Button className="w-full h-12 font-bold" onClick={() => { setOpponent({ full_name: `${t('chessPlayAi')} Niv. ${difficultyLevel}`, profile_photo: '/avatars/robot.png' }); setBetAmount(0); setGameState('in-game'); }}>{t('chessStartDuel')}</Button>
                        </CardContent>
                    </Card>
                )}

                {(gameState === 'create-invite' || gameState === 'invite-type' || gameState === 'join-invite') && (
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                         <CardHeader>
                            <Button variant="ghost" size="icon" onClick={() => setGameState('mode-select')}><ArrowLeft/></Button>
                            <CardTitle>{gameState === 'join-invite' ? t('chessJoinInvite') : t('chessCreateInvite')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {gameState === 'invite-type' && (
                                <div className="grid gap-4">
                                    <Button className="h-16 text-lg font-bold" onClick={() => setGameState('create-invite')}><Plus className="mr-2"/> {t('chessCreateInvite')}</Button>
                                    <Button className="h-16 text-lg font-bold" variant="outline" onClick={() => setGameState('join-invite')}><ArrowRightLeft className="mr-2"/> {t('chessJoinInvite')}</Button>
                                </div>
                            )}
                            {gameState === 'create-invite' && (
                                <Form {...createGameForm}>
                                    <form onSubmit={createGameForm.handleSubmit(handleCreateGameSubmit)} className="space-y-6">
                                        <FormField control={createGameForm.control} name="betAmount" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('chessBetAmount')}</FormLabel>
                                                <FormControl><Input type="number" {...field} className="bg-zinc-900 border-zinc-700 h-12 text-lg font-bold" /></FormControl>
                                                <FormMessage />
                                                <p className="text-[10px] text-zinc-500">{t('chessBetInfo')}</p>
                                            </FormItem>
                                        )} />
                                        <FormField control={createGameForm.control} name="currency" render={({field}) => (
                                            <FormItem><FormLabel>{t('actionGridExchange')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-zinc-900 border-zinc-700 h-12"><SelectValue/></SelectTrigger></FormControl><SelectContent className="bg-zinc-800 text-white">{userCurrencies.map(c => (<SelectItem key={c.code} value={c.code}>{c.code} ({c.balance})</SelectItem>))}</SelectContent></Select></FormItem>
                                        )} />
                                        <Button type="submit" className="w-full h-14 font-black">{t('chessGenerateCode')}</Button>
                                    </form>
                                </Form>
                            )}
                            {gameState === 'join-invite' && (
                                <Form {...joinGameForm}>
                                    <form onSubmit={joinGameForm.handleSubmit(handleJoinGameSubmit)} className="space-y-6">
                                        <FormField control={joinGameForm.control} name="gameCode" render={({ field }) => (
                                            <FormItem><FormLabel>{t('chessJoinInvite')}</FormLabel><FormControl><Input placeholder="EX: CH77AF92" {...field} className="bg-zinc-900 border-zinc-700 h-12 text-lg font-bold text-center tracking-widest" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <Button type="submit" className="w-full h-14 font-black">{t('chessJoinInvite')}</Button>
                                    </form>
                                </Form>
                            )}
                        </CardContent>
                    </Card>
                )}

                {gameState === 'waiting' && (
                    <Card className="bg-zinc-800 border-zinc-700 text-center text-white">
                        <CardHeader><CardTitle>{t('chessInvitationActive')}</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <p className="text-sm text-zinc-400">{t('chessShareCode')}</p>
                            <div className="flex items-center gap-2 p-4 bg-zinc-950 rounded-2xl border border-primary/20">
                                <p className="text-3xl font-black tracking-[0.3em] flex-1 text-primary">{gameCode}</p>
                                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(gameCode!); toast({ title: t('toastCopied') }); }}><Copy /></Button>
                            </div>
                            <div className="flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
                            <p className="text-xs text-zinc-500 italic">{t('chessWaitingOpponent')}</p>
                            <Button variant="ghost" onClick={resetGame} className="text-zinc-500">{t('chessCancelInvite')}</Button>
                        </CardContent>
                    </Card>
                )}

                {(gameState === 'in-game' || gameState === 'game-over') && (
                    <div className="space-y-4">
                        <PlayerInfo player={userColor === 'white' ? opponent : user} isTurn={chessLogic.turn === 'black'} timeLeft={chessLogic.turn === 'black' ? moveTime : 60} />
                        <div className="aspect-square bg-[#779556] grid grid-cols-8 shadow-2xl rounded-lg overflow-hidden border-4 border-zinc-800">
                            {chessboardRows.map((rowIndex) =>
                                chessLogic.board[rowIndex].map((piece, colIndex) => {
                                    const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex;
                                    const isValidMove = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                                    const kingInCheck = piece?.type === 'king' && piece?.color === chessLogic.turn && isCheck;
                                    return (
                                        <div key={`${rowIndex}-${colIndex}`} className={cn("flex items-center justify-center aspect-square cursor-pointer transition-colors relative", (rowIndex + colIndex) % 2 === 0 ? 'bg-[#ebecd0]' : 'bg-[#779556]', isSelected && 'bg-yellow-400/80', isValidMove && 'hover:bg-primary/20')} onClick={() => handleCellClick(rowIndex, colIndex)}>
                                            {kingInCheck && <div className="absolute inset-0 bg-red-500/40 animate-pulse" />}
                                            {piece && <ChessPieceIcon piece={piece} />}
                                            {isValidMove && <div className="absolute inset-0 flex items-center justify-center"><div className="h-4 w-4 rounded-full bg-black/10" /></div>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <PlayerInfo player={userColor === 'white' ? user : opponent} isTurn={chessLogic.turn === 'white'} timeLeft={chessLogic.turn === 'white' ? moveTime : 60} />
                    </div>
                )}
            </div>

            {(gameState === 'in-game' || gameState === 'game-over') && (
                <div className="w-full lg:w-80 space-y-4 order-1 lg:order-2">
                    <Card className="bg-zinc-900 border-zinc-800 text-white">
                        <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-tighter text-zinc-500">Détails du Match</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{t('chessPot')}</p>
                                <p className="text-xl font-black text-primary">{(betAmount * 2).toLocaleString()} {betCurrency}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" className={cn("h-10 flex-1 gap-2", isPaused && "bg-primary text-white border-primary")} onClick={handlePauseRequest} disabled={hasUsedPause || isPaused}>
                                    {isPaused ? <><Loader2 className="h-4 w-4 animate-spin"/> {pauseTimeLeft}s</> : <><Pause className="h-4 w-4"/> {t('chessPause')}</>}
                                </Button>
                                {gameMode === 'player' && (
                                    <Button variant="outline" size="sm" className="h-10 flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/5" onClick={handleProposeDraw} disabled={!!drawProposedBy}>
                                        <Handshake className="h-4 w-4"/> {drawProposedBy === user.id ? t('chessDrawProposed') : t('chessProposeDraw')}
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-zinc-600">{t('chessMoveHistory')}</p>
                                <div className="grid grid-cols-4 gap-1">
                                    {chessLogic.moveHistory.slice(-12).map((m, i) => (
                                        <Badge key={i} variant="secondary" className="font-mono text-[10px] justify-center bg-zinc-800">{m.notation}</Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter><Button variant="destructive" className="w-full font-bold" onClick={handleQuitGame}>{gameState === 'in-game' ? t('chessAbandon') : t('chessQuit')}</Button></CardFooter>
                    </Card>
                    {isCheck && !isCheckmate && (
                        <div className="p-3 rounded-lg flex items-start gap-3 bg-red-500/20 text-red-500 animate-pulse">
                            <ShieldCheck className="h-4 w-4" />
                            <div><h5 className="font-bold text-sm">{t('chessCheckTitle')}</h5><p className="text-xs">{chessLogic.turn === userColor ? t('chessCheckDescYour') : t('chessCheckDescOpponent')}</p></div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Separator({ className }: { className?: string }) {
    return <div className={cn("h-px w-full bg-border", className)} />;
}
